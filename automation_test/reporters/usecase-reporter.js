class UseCaseReporter {
  constructor() {
    this.rows = [];
  }

  onTestEnd(test, result) {
    const getAnnotation = (type) => {
      const found = test.annotations.find((a) => a.type === type);
      return found ? found.description : '';
    };

    const customActual = getAnnotation('actual_result');

    let actualResult = customActual;
    if (!actualResult) {
      if (result.status === 'passed') {
        actualResult = 'Same as expected';
      } else if (result.error?.message) {
        actualResult = result.error.message.split('\n')[0];
      } else {
        actualResult = result.status;
      }
    }

    this.rows.push({
      testcaseId: getAnnotation('testcase_id'),
      category: getAnnotation('category'),
      title: getAnnotation('title'),
      precondition: getAnnotation('precondition'),
      steps: getAnnotation('steps'),
      expected: getAnnotation('expected'),
      actual: actualResult,
      status: result.status === 'passed' ? 'Passed' : 'Failed',
    });
  }

  onEnd() {
    console.log('\n====================================================================================================');
    console.log('DEVICE ACTION TEST REPORT');
    console.log('====================================================================================================\n');

    this.rows.forEach((row, index) => {
      console.log(`Row             : ${index + 1}`);
      console.log(`Testcase ID     : ${row.testcaseId}`);
      console.log(`Module          : ${row.category}`);
      console.log(`Testcase Title  : ${row.title}`);
      console.log(`Pre-condition   : ${row.precondition}`);
      console.log(`Steps           : ${row.steps}`);
      console.log(`Expected result : ${row.expected}`);
      console.log(`Actual result   : ${row.actual}`);
      console.log(`Status          : ${row.status}`);
      console.log('----------------------------------------------------------------------------------------------------');
    });

    const passedCount = this.rows.filter((row) => row.status === 'Passed').length;
    const failedCount = this.rows.filter((row) => row.status === 'Failed').length;

    console.log('\nSUMMARY');
    console.log('====================================================================================================');
    console.log(`Total  : ${this.rows.length}`);
    console.log(`Passed : ${passedCount}`);
    console.log(`Failed : ${failedCount}`);
    console.log('====================================================================================================\n');
  }
}

module.exports = UseCaseReporter;