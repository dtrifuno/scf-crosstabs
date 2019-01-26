$(() => {
  /* Weighted Aggregators */
  function usFmtInt(x) {
    return x.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  function usFmt(x) {
    return x.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  const weightedAggregators = weight => ({
    Count: function weightedCount() {
      return (data, rowKey, colKey) => ({
        count: 0,
        push(record) { this.count += parseFloat(record[weight]); },
        value() { return this.count; },
        format: x => (Number.isNaN(x) ? x : usFmt(x)),
      });
    },
    'Sample Count': function sampleCount() {
      return (data, rowKey, colKey) => ({
        count: 0,
        push(record) { this.count += 1; },
        value() { return this.count / 5; },
        format: x => (Number.isNaN(x) ? x : usFmtInt(x)),
      });
    },
    'Sum of': function weightedSum([attr]) {
      return (data, rowKey, colKey) => ({
        sum: 0,
        push(record) { this.sum += parseFloat(record[weight]) * parseFloat(record[attr]); },
        value() { return this.sum; },
        format: x => (Number.isNaN(x) ? x : usFmt(x)),
        numInputs: 1,
      });
    },
    'Average of': function weightedMean([attr]) {
      return (data, rowKey, colKey) => ({
        weightedSum: 0,
        sumOfWeights: 0,
        weightedMean: 0,
        push(record) {
          const thisX = parseFloat(record[attr]);
          const thisWeight = parseFloat(record[weight]);
          if (Number.isNaN(thisX) || Number.isNaN(thisWeight)) {
            return;
          }
          this.sumOfWeights += thisWeight;
          this.weightedSum += thisWeight * thisX;
          this.weightedMean = this.weightedSum / this.sumOfWeights;
        },
        value() { return this.weightedMean; },
        format: x => (Number.isNaN(x) ? x : usFmt(x)),
        numInputs: 1,
      });
    },
    'Median of': function weightedMedian([attr]) {
      return (data, rowKey, colKey) => ({
        sumOfWeights: 0,
        vals: [],
        push(record) {
          const thisX = parseFloat(record[attr]);
          const thisWeight = parseFloat(record[weight]);
          this.sumOfWeights += thisWeight;
          this.vals.push([thisX, thisWeight]);
        },
        value() {
          let runningWeightSum = 0;
          const targetWeight = 0.5 * this.sumOfWeights;
          this.vals.sort((xs, ys) => ys[0] - xs[0]);
          for (const [x, w] of this.vals) {
            runningWeightSum += w;
            if (runningWeightSum >= targetWeight) {
              return x;
            }
          }
          return this.vals[this.vals.length - 1][0];
        },
        format: x => (Number.isNaN(x) ? x : usFmt(x)),
        numInputs: 1,
      });
    },
    'Maximum of': $.pivotUtilities.aggregators.Maximum,
    'Minimum of': $.pivotUtilities.aggregators.Minimum,
  });


  /* Categorical Features */
  function fromObject(attr, obj) { return record => obj[record[attr]]; }
  const sex = { 1: 'Male', 2: 'Female' };

  const age = {
    1: '35 and under', 2: '35-44', 3: '45-54', 4: '55-64', 5: '65-74', 6: '74 and over',
  };

  const edu = {
    1: '1: no high school diploma',
    2: '2: high school diploma',
    3: '3: some college',
    4: '4: bachelor\'s degree or higher',
  };

  const race = {
    1: 'white non-Hispanic',
    2: 'black/African-American',
    3: 'Hispanic',
    4: 'Asian',
    5: 'other',
  };

  const marriage = { 1: 'married/cohabitating', 2: 'not married/cohabitating' };

  const workStatus = {
    1: 'employed',
    2: 'self-employed',
    3: 'retired/disabled/student/homemaker',
    4: 'other not working',
  };

  const occupation = {
    1: 'managerial/professional',
    2: 'technical/sales/services',
    3: 'other',
    4: 'not working',
  };

  const categoricalVariables = {
    Sex: fromObject('SEX', sex),
    'Age (fine)': function ageBin(record) {
      const age = parseInt(record.AGE, 10);
      if (age > 73) {
        return '73+';
      }
      const lowerAge = Math.round(age - ((age - 18) % 8));
      return `${lowerAge}-${lowerAge + 7}`;
    },
    'Wealth Class': function wealthBin(record) {
      const worth = parseFloat(record.NETWORTH);
      if (worth < 0) {
        return '1: <0';
      } if (worth < 40000) {
        return '2: 0-40k';
      } if (worth < 100000) {
        return '3: 40k-100k';
      } if (worth < 1000000) {
        return '4: 100k-1M';
      } if (worth < 5000000) {
        return '5: 1M-5M (HNW)';
      } if (worth < 30000000) {
        return '6: 5M-30M (VHNW)';
      }
      return '7: >30M (UHNW)';
    },
    'Income Class': function incomeBin(record) {
      const income = parseFloat(record.INCOME);
      if (income <= 20000) {
        return '2: 0-20k';
      } if (income <= 39000) {
        return '3: 20k-39k';
      } if (income <= 83000) {
        return '4: 39k-83k';
      } if (income <= 170000) {
        return '5: 83k-170k';
      } if (income <= 500000) {
        return '6: 170k-500k';
      }
      return '8: >500k';
    },
    'Age (FRB)': fromObject('AGECL', age),
    'Education Level': fromObject('EDCL', edu),
    Race: fromObject('RACE', race),
    Marriage: fromObject('MARRIED', marriage),
    'Has Children': record => ((record.KIDS !== '0') ? 'Yes' : 'No'),
    'No. of Children': record => record.KIDS,
    'Is Working': record => ((record.LF !== '0') ? 'Yes' : 'No'),
    'Work Type': fromObject('OCCAT1', workStatus),
    Occupation: fromObject('OCCAT2', occupation),
  };


  /* Continuous Features */
  const continuousVariables = {
    Income: record => record.INCOME,
    'Wage Income': record => record.WAGEINC,
    'Food Spending': record => parseFloat(record.FOODHOME) + parseFloat(record.FOODAWAY) + parseFloat(record.FOODDELV),
    'Food Spending to Income': record => (parseFloat(record.FOODHOME) + parseFloat(record.FOODAWAY) + parseFloat(record.FOODDELV)) / parseFloat(record.INCOME),
    'Home Food Ratio': record => parseFloat(record.FOODHOME) / (parseFloat(record.FOODHOME) + parseFloat(record.FOODAWAY) + parseFloat(record.FOODDELV)),
    'Net Worth': record => record.NETWORTH,
    'Net Worth excl. EduLoans': record => parseFloat(record.NETWORTH) + parseFloat(record.EDN_INST),
    'Net Worth excl. Vehicles': record => parseFloat(record.NETWORTH) - parseFloat(record.VEHIC),
    'Directly Held Mutual Funds': record => record.NMMF,
    'Retirement Accounts': record => record.RETQLIQ,
    'Primary Residence': record => record.HOUSES,
    'Liquid Assets': record => record.LIQ,
    'Total Assets': record => record.ASSET,
    'Credit Card Debt': record => record.CCBAL,
    'Education Loans': record => record.EDN_INST,
    'Residential Loans': record => record.MRTHEL,
    'Leverage Ratio': record => record.LEVRATIO,
    'Total Debt to Income': record => record.DEBT2INC,
    'Total Debt': record => record.DEBT,
    'Debt Payments to Income': record => record.PIRTOTAL,
  };

  const allVariables = Object.assign({}, categoricalVariables, continuousVariables);

  const renderers = $.extend($.pivotUtilities.renderers,
    $.pivotUtilities.plotly_renderers);

  const aggregators = weightedAggregators('WGT');
  const tpl = $.pivotUtilities.aggregatorTemplates;
  $.extend(aggregators, {
    'Fraction of Total': tpl.fractionOf(aggregators.Count, 'total', usFmt),
    'Fraction of Rows': tpl.fractionOf(aggregators.Count, 'row', usFmt),
    'Fraction of Columns': tpl.fractionOf(aggregators.Count, 'col', usFmt),
  });
  const pivotOptions = fields => ({
    aggregators,
    hiddenFromAggregators: Object.keys(categoricalVariables),
    hiddenFromDragDrop: Object.keys(continuousVariables),
    hiddenAttributes: fields,
    renderers,
    rendererOptions: {
      table: {
        rowTotals: false,
        colTotals: false,
      },
    },
    derivedAttributes: allVariables,
    cols: ['Age (fine)'],
    rows: ['Education Level'],
    aggregatorName: 'Median of',
    rendererName: 'Line Chart',
    vals: ['Wage Income'],
    rowOrder: 'key_a_to_z',
    colOrder: 'key_a_to_z',
  });

  JSZipUtils.getBinaryContent('SCFP2016.zip', (err, data) => {
    if (err) {
      $('#loading').toggleClass('alert-primary alert-danger');
      $('#loading').html('<p class="lead"> Download failed. Please try reloading this page at a later time.</p>');
      throw err;
    }
    JSZip.loadAsync(data).then((zip) => {
      zip.file('SCFP2016.csv').async('string').then((buf) => {
        Papa.parse(buf, {
          skipEmptyLines: true,
          header: true,
          complete: (parsed) => {
            $('#loading').hide();
            $('#output').pivotUI(parsed.data, pivotOptions(parsed.meta.fields));
          },
        });
      });
    });
  });
});
