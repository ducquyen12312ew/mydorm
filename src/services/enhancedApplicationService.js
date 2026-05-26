/**
 * ENHANCED APPLICATION FORM SERVICE
 * Manages unified student registration with ranking criteria
 */

const AllocationRegistration = require('../schemas/AllocationRegistrationSchema');
const PriorityClaimSchema = require('../schemas/PriorityClaimSchema');
const { logger } = require('../config/logger');

class EnhancedApplicationService {
  /**
   * Create comprehensive application with all ranking criteria
   */
  static async createApplication(studentId, applicationData) {
    try {
      const {
        distance,
        financialCondition,
        priorityLevel,
        priorityReason,
        specialNeeds,
        preferredBuildings,
        attachments,
        academicYear
      } = applicationData;

      // Validate distance
      if (distance < 0 || distance > 1000) {
        throw new Error('Distance must be between 0-1000 km');
      }

      // Validate financial condition (1-4 scale)
      if (![1, 2, 3, 4].includes(financialCondition)) {
        throw new Error('Financial condition must be 1-4');
      }

      // Calculate scoring components
      const distanceScore = this.calculateDistanceScore(distance);
      const financialScore = this.calculateFinancialScore(financialCondition);
      const priorityScore = this.calculatePriorityScore(priorityLevel);

      // Total weighted score
      const totalScore = (
        distanceScore * 0.35 +
        financialScore * 0.35 +
        priorityScore * 0.30
      );

      // Create registration record
      const registration = await AllocationRegistration.create({
        studentId,
        academicYear,
        status: 'PENDING',
        distance,
        financialCondition,
        priorityLevel,
        priorityReason,
        specialNeeds,
        preferredBuildings,
        attachments,
        priorityScore: {
          distance: distanceScore,
          financial: financialScore,
          priority: priorityScore,
          total: totalScore
        },
        submissionDate: new Date(),
        verificationStatus: 'PENDING'
      });

      logger.info('Application created', {
        studentId,
        registrationId: registration._id,
        totalScore
      });

      return registration;
    } catch (error) {
      logger.error('Application creation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Calculate distance score (higher distance = higher score for fairness)
   * 0 km = 10, 500+ km = 100
   */
  static calculateDistanceScore(distance) {
    if (distance >= 500) return 100;
    if (distance >= 300) return 85;
    if (distance >= 100) return 70;
    if (distance >= 50) return 50;
    if (distance >= 10) return 30;
    return 10; // Very close to campus
  }

  /**
   * Calculate financial difficulty score
   * 1=Critical (100) → 4=Good (20)
   */
  static calculateFinancialScore(tier) {
    const scores = {
      1: 100, // Critical financial difficulty
      2: 75,  // High difficulty
      3: 50,  // Moderate difficulty
      4: 20   // Good financial situation
    };
    return scores[tier] || 50;
  }

  /**
   * Calculate priority level score
   */
  static calculatePriorityScore(level) {
    const scores = {
      'SPECIAL': 100,
      'HIGH': 75,
      'MEDIUM': 50,
      'LOW': 25
    };
    return scores[level] || 25;
  }

  /**
   * Get ranking position and percentile
   */
  static async getRankingInfo(studentId, academicYear) {
    try {
      // Get student's application
      const studentApp = await AllocationRegistration.findOne({
        studentId,
        academicYear
      }).lean();

      if (!studentApp) {
        return null;
      }

      // Get rank (all applications sorted by score)
      const allApps = await AllocationRegistration.find({
        academicYear,
        status: { $in: ['PENDING', 'ALLOCATED', 'WAITLIST'] }
      })
        .select('priorityScore.total')
        .lean();

      const sortedByScore = allApps.sort((a, b) => 
        b.priorityScore.total - a.priorityScore.total
      );

      const rank = sortedByScore.findIndex(app => app._id.toString() === studentApp._id.toString()) + 1;
      const percentile = ((rank / sortedByScore.length) * 100).toFixed(1);
      const totalApplicants = sortedByScore.length;

      return {
        rank,
        totalApplicants,
        percentile,
        score: studentApp.priorityScore.total,
        status: studentApp.status,
        breakdown: {
          distance: studentApp.priorityScore.distance,
          financial: studentApp.priorityScore.financial,
          priority: studentApp.priorityScore.priority
        }
      };
    } catch (error) {
      logger.error('Ranking info failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get forced exit candidates (lowest ranking students)
   */
  static async getEvictionCandidates(academicYear, count = 20) {
    try {
      const candidates = await AllocationRegistration.find({
        academicYear,
        status: 'ALLOCATED'
      })
        .populate('studentId', 'name email')
        .sort({ 'priorityScore.total': 1 }) // Lowest scores first
        .limit(count)
        .lean();

      return candidates.map(app => ({
        studentId: app.studentId._id,
        studentName: app.studentId.name,
        studentEmail: app.studentId.email,
        score: app.priorityScore.total,
        rank: app.rank,
        reason: `Low ranking score (${app.priorityScore.total.toFixed(1)}/100)`,
        components: {
          distance: app.priorityScore.distance,
          financial: app.priorityScore.financial,
          priority: app.priorityScore.priority
        }
      }));
    } catch (error) {
      logger.error('Eviction candidates failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get scoring breakdown explanation for student
   */
  static getScoringExplanation(ranking) {
    const explanations = [];

    // Distance explanation
    if (ranking.breakdown.distance >= 85) {
      explanations.push({
        factor: 'Distance',
        score: ranking.breakdown.distance,
        impact: 'High priority - far from campus',
        weight: '35%'
      });
    } else if (ranking.breakdown.distance >= 50) {
      explanations.push({
        factor: 'Distance',
        score: ranking.breakdown.distance,
        impact: 'Moderate distance',
        weight: '35%'
      });
    } else {
      explanations.push({
        factor: 'Distance',
        score: ranking.breakdown.distance,
        impact: 'Close to campus',
        weight: '35%'
      });
    }

    // Financial explanation
    if (ranking.breakdown.financial >= 75) {
      explanations.push({
        factor: 'Financial Difficulty',
        score: ranking.breakdown.financial,
        impact: 'Significant financial need',
        weight: '35%'
      });
    } else if (ranking.breakdown.financial >= 50) {
      explanations.push({
        factor: 'Financial Difficulty',
        score: ranking.breakdown.financial,
        impact: 'Moderate financial situation',
        weight: '35%'
      });
    } else {
      explanations.push({
        factor: 'Financial Difficulty',
        score: ranking.breakdown.financial,
        impact: 'Good financial situation',
        weight: '35%'
      });
    }

    // Priority explanation
    if (ranking.breakdown.priority >= 75) {
      explanations.push({
        factor: 'Priority Level',
        score: ranking.breakdown.priority,
        impact: 'High priority status',
        weight: '30%'
      });
    } else {
      explanations.push({
        factor: 'Priority Level',
        score: ranking.breakdown.priority,
        impact: 'Standard priority',
        weight: '30%'
      });
    }

    return explanations;
  }
}

module.exports = EnhancedApplicationService;
