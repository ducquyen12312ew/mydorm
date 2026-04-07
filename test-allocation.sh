#!/bin/bash
# Test allocation system

CYCLE_ID="6967c973ff7b5efa50f57516"
SERVER="http://localhost:5000"

echo ""
echo "========================================"
echo "Test Allocation System"
echo "========================================"
echo ""

echo "1. Get Cycle Status"
echo ""
curl -X GET "$SERVER/api/allocation/cycles/$CYCLE_ID" \
  -H "Content-Type: application/json"

echo ""
echo ""
echo "2. Execute Allocation"
echo ""
curl -X POST "$SERVER/admin/allocation/cycles/$CYCLE_ID/execute" \
  -H "Content-Type: application/json" \
  -d "{}"

echo ""
echo ""
echo "3. Get Dashboard"
echo ""
curl -X GET "$SERVER/api/allocation/dashboard/2025-2026" \
  -H "Content-Type: application/json"

echo ""
echo "========================================"
echo "Test completed"
echo "========================================"
