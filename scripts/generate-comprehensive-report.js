const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function generateComprehensiveReport() {
  const workbook = new ExcelJS.Workbook();
  
  // Integration Test Results
  const integrationSheet = workbook.addWorksheet('Integration Tests');
  integrationSheet.columns = [
    { header: 'Test Name', key: 'test', width: 30 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Duration (ms)', key: 'duration', width: 15 },
    { header: 'Error', key: 'error', width: 50 }
  ];
  
  try {
    const integrationPath = path.join(process.cwd(), 'integration-test-results', 'integration-results.json');
    if (fs.existsSync(integrationPath)) {
      const integrationData = JSON.parse(fs.readFileSync(integrationPath, 'utf8'));
      integrationData.results?.forEach(result => {
        integrationSheet.addRow({
          test: result.test,
          status: result.status,
          duration: result.duration,
          error: result.error || ''
        });
      });
    }
  } catch (e) {
    console.log('Integration test results not found');
  }
  
  // E2E Test Results
  const e2eSheet = workbook.addWorksheet('E2E Tests');
  e2eSheet.columns = [
    { header: 'Test Name', key: 'test', width: 40 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Duration (ms)', key: 'duration', width: 15 },
    { header: 'Screenshot', key: 'screenshot', width: 30 }
  ];
  
  try {
    const e2eResultsPath = path.join(process.cwd(), 'e2e-test-results', 'results.json');
    if (fs.existsSync(e2eResultsPath)) {
      const e2eData = JSON.parse(fs.readFileSync(e2eResultsPath, 'utf8'));
      e2eData.suites?.forEach(suite => {
        suite.specs?.forEach(spec => {
          spec.tests?.forEach(test => {
            e2eSheet.addRow({
              test: test.title,
              status: test.outcome,
              duration: test.results?.[0]?.duration || 0,
              screenshot: test.results?.[0]?.attachments?.[0]?.name || ''
            });
          });
        });
      });
    }
  } catch (e) {
    console.log('E2E test results not found');
  }
  
  // Summary Sheet
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Test Type', key: 'type', width: 20 },
    { header: 'Total Tests', key: 'total', width: 15 },
    { header: 'Passed', key: 'passed', width: 15 },
    { header: 'Failed', key: 'failed', width: 15 },
    { header: 'Success Rate', key: 'rate', width: 15 }
  ];
  
  const integrationTotal = integrationSheet.rowCount - 1;
  const integrationPassed = integrationSheet.getColumn('status').values.filter(v => v === 'PASS').length;
  const e2eTotal = e2eSheet.rowCount - 1;
  const e2ePassed = e2eSheet.getColumn('status').values.filter(v => v === 'passed').length;
  
  summarySheet.addRow({
    type: 'Integration Tests',
    total: integrationTotal,
    passed: integrationPassed,
    failed: integrationTotal - integrationPassed,
    rate: integrationTotal > 0 ? `${Math.round(integrationPassed / integrationTotal * 100)}%` : '0%'
  });
  
  summarySheet.addRow({
    type: 'E2E Tests',
    total: e2eTotal,
    passed: e2ePassed,
    failed: e2eTotal - e2ePassed,
    rate: e2eTotal > 0 ? `${Math.round(e2ePassed / e2eTotal * 100)}%` : '0%'
  });
  
  // Save Excel file
  await workbook.xlsx.writeFile('test-report.xlsx');
  
  // Generate JSON summary
  const summary = {
    timestamp: new Date().toISOString(),
    integration: {
      total: integrationTotal,
      passed: integrationPassed,
      failed: integrationTotal - integrationPassed
    },
    e2e: {
      total: e2eTotal,
      passed: e2ePassed,
      failed: e2eTotal - e2ePassed
    }
  };
  
  fs.writeFileSync('test-summary.json', JSON.stringify(summary, null, 2));
  
  console.log('✅ Test report generated: test-report.xlsx');
  console.log('✅ Test summary generated: test-summary.json');
}

generateComprehensiveReport().catch(console.error);