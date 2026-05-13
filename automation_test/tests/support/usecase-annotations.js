function setTestCaseMetadata(testInfo, data) {
  testInfo.annotations.push({ type: 'testcase_id', description: data.testcaseId });
  testInfo.annotations.push({ type: 'category', description: data.category });
  testInfo.annotations.push({ type: 'title', description: data.title });
  testInfo.annotations.push({ type: 'precondition', description: data.precondition });
  testInfo.annotations.push({ type: 'steps', description: data.steps.join(' | ') });
  testInfo.annotations.push({ type: 'expected', description: data.expected });
}

function setActualResult(testInfo, actualResult) {
  testInfo.annotations.push({ type: 'actual_result', description: actualResult });
}

module.exports = {
  setActualResult,
  setTestCaseMetadata,
};
