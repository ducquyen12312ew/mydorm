#!/usr/bin/env node
/**
 * Fix violations with 'investigating' status - migrate to 'pending'
 * Run this script once to clean up old violation records
 * Usage: node scripts/fix-investigating-violations.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function fixViolations() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dormitory_graduation', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('Connected to MongoDB');

        // Import ViolationModel
        const { ViolationModel } = require('../src/schemas/ViolationSchema');

        // Count violations with 'investigating' status
        const investigatingCount = await ViolationModel.countDocuments({ status: 'investigating' });
        
        if (investigatingCount === 0) {
            console.log('✓ No violations with "investigating" status found');
            process.exit(0);
        }

        console.log(`\nFound ${investigatingCount} violations with "investigating" status`);
        console.log('Updating to "pending" status...\n');

        // Update all investigating violations to pending
        const result = await ViolationModel.updateMany(
            { status: 'investigating' },
            { $set: { status: 'pending' } }
        );

        console.log(`✓ Successfully updated ${result.modifiedCount} violations`);
        console.log('\nViolations have been migrated from "investigating" → "pending"');
        console.log('You can now process them through the standard workflow');

        await mongoose.connection.close();
        console.log('\nDatabase connection closed');
        process.exit(0);
    } catch (error) {
        console.error('Error fixing violations:', error);
        process.exit(1);
    }
}

fixViolations();
