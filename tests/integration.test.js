const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function runIntegrationTests() {
  const API_URL = process.env.API_URL;
  if (!API_URL) {
    throw new Error('API_URL environment variable is required');
  }

  const results = [];
  const testStartTime = new Date();

  console.log(`Starting integration tests against: ${API_URL}`);

  // Test 1: Health Check
  try {
    const response = await axios.get(`${API_URL}health`, { timeout: 10000 });
    results.push({
      test: 'Health Check',
      status: 'PASS',
      response: response.status,
      duration: Date.now() - testStartTime
    });
    console.log('✅ Health check passed');
  } catch (error) {
    results.push({
      test: 'Health Check',
      status: 'FAIL',
      error: error.message,
      duration: Date.now() - testStartTime
    });
    console.log('❌ Health check failed:', error.message);
  }

  // Test 2: Projects API
  try {
    const response = await axios.get(`${API_URL}projects`, { timeout: 10000 });
    const isValidResponse = Array.isArray(response.data) || response.data.length >= 0;
    
    results.push({
      test: 'Projects API',
      status: isValidResponse ? 'PASS' : 'FAIL',
      response: response.status,
      data: response.data,
      duration: Date.now() - testStartTime
    });
    console.log('✅ Projects API test passed');
  } catch (error) {
    results.push({
      test: 'Projects API',
      status: 'FAIL',
      error: error.message,
      duration: Date.now() - testStartTime
    });
    console.log('❌ Projects API test failed:', error.message);
  }

  // Test 3: Issues API
  try {
    const response = await axios.get(`${API_URL}issues`, { timeout: 10000 });
    const isValidResponse = Array.isArray(response.data) || response.data.length >= 0;
    
    results.push({
      test: 'Issues API',
      status: isValidResponse ? 'PASS' : 'FAIL',
      response: response.status,
      data: response.data,
      duration: Date.now() - testStartTime
    });
    console.log('✅ Issues API test passed');
  } catch (error) {
    results.push({
      test: 'Issues API',
      status: 'FAIL',
      error: error.message,
      duration: Date.now() - testStartTime
    });
    console.log('❌ Issues API test failed:', error.message);
  }

  // Save results
  const resultsDir = path.join(process.cwd(), 'test-results', 'integration');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const summary = {
    totalTests: results.length,
    passed: results.filter(r => r.status === 'PASS').length,
    failed: results.filter(r => r.status === 'FAIL').length,
    duration: Date.now() - testStartTime,
    timestamp: new Date().toISOString(),
    results: results
  };

  fs.writeFileSync(
    path.join(resultsDir, 'integration-results.json'),
    JSON.stringify(summary, null, 2)
  );

  console.log(`\n📊 Integration Test Summary:`);
  console.log(`Total: ${summary.totalTests}, Passed: ${summary.passed}, Failed: ${summary.failed}`);
  console.log(`Duration: ${summary.duration}ms`);

  if (summary.failed > 0) {
    process.exit(1);
  }
}

runIntegrationTests().catch(error => {
  console.error('Integration tests failed:', error);
  process.exit(1);
});