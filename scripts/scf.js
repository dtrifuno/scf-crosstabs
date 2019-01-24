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

function weightedAggregators(weight) { return {
  Count: function weightedCount() {
    return function(data, rowKey, colKey) {
      return {
        count: 0,
        push: function(record) { this.count += parseFloat(record[weight]); },
        value: function() { return this.count; },
        format: (x) => isNaN(x) ? x : usFmt(x),
      };
    };
  },
  'Sample Count': function sampleCount() {
    return function(data, rowKey, colKey) {
      return {
        count: 0,
        push: function(record) { this.count += 1; },
        value: function() { return this.count / 5; },
        format: (x) => isNaN(x) ? x : usFmtInt(x),
      };
    };
  },
  'Sum of': function weightedSum([attr]) {
    return function(data, rowKey, colKey) {
      return {
        sum: 0,
        push: function(record) { this.sum += parseFloat(record[weight])*parseFloat(record[attr]); },
        value: function() { return this.sum; },
        format: (x) => isNaN(x) ? x : usFmt(x),
        numInputs: 1
      };
    };
  },
  'Average of': function weightedMean([attr]) {
    return function(data, rowKey, colKey) {
      return {
        weightedSum: 0,
        sumOfWeights: 0,
        weightedMean: 0,
        push: function(record) {
          thisX = parseFloat(record[attr]);
          thisWeight = parseFloat(record[weight]);
          if (isNaN(thisX) || isNaN(thisWeight)) {
            return;
          }
          this.sumOfWeights += thisWeight;
          this.weightedSum += thisWeight * thisX;
          this.weightedMean = this.weightedSum / this.sumOfWeights;
        },
        value: function() { return this.weightedMean; },
        format: (x) => isNaN(x) ? x : usFmt(x),
        numInputs: 1
      };
    };
  },
  'Maximum of': $.pivotUtilities.aggregators.Maximum,
  'Minimum of': $.pivotUtilities.aggregators.Minimum,
};};


/* Categorical Features */
function fromObject(attr, obj) { return record => obj[record[attr]]; }
const sex = { 1: 'Male', 2: 'Female' };
const age = { 1: '35 and under', 2: '35-44', 3: '45-54', 4: '55-64', 5: '65-74', 6: '74 and over' };
const edu = { 1: '1: no high school diploma', 2: '2: high school diploma',
  3: '3: some college', 4: '4: bachelor\'s degree or higher' };
const race = { 1: 'white non-Hispanic', 2: 'black/African-American',
  3: 'Hispanic', 4: 'Asian', 5: 'other' };
const marriage = { 1: 'married/cohabitating', 2: "not married/cohabitating" };
const workStatus = { 1: 'employed', 2: 'self-employed',
  3: 'retired/disabled/student/homemaker', 4: 'other not working' };
const occupation = { 1: 'managerial/professional',
  2: 'technical/sales/services', 3: 'other', 4: 'not working' };

const categoricalVariables = {
  'Sex': fromObject('SEX', sex),
  'Age (FRB)': fromObject('AGECL', age),
  'Education Level': fromObject('EDCL', edu),
  'Race': fromObject('RACE', race),
  'Marriage': fromObject('MARRIED', marriage),
  'Children': (record) => record['KIDS'],
  'Work Status': fromObject('OCCAT1', workStatus),
  'Occupation': fromObject('OCCAT2', occupation)
};


/* Continuous Features */
const continuousVariables = {
  'Income': record => record['INCOME'],
  'Wage Income': record => record['WAGEINC'],
  'Net Worth': record => record['NETWORTH'],
  'Net Worth excl. EduLoans': (record) => parseFloat(record['NETWORTH']) + parseFloat(record['EDN_INST']),
  'Net Worth excl. Vehicles': (record) => parseFloat(record['NETWORTH']) - parseFloat(record['VEHIC']),
  'Directly Held Mutual Funds': record => record.NMMF,
  'Retirement Accounts': record => record.RETQLIQ,
  'Primary Residence': record => record.HOUSES,
  'Liquid Assets': record => record.LIQ,
  'Total Assets': record => record.ASSET,
  'Total Debt': record => record.DEBT,
  'Residential Loans': record => record.MRTHEL,
  'Credit Card Debt': record => record.CCBAL,
  'Education Loans': record => record.EDN_INST,
};

const allVariables = Object.assign({}, categoricalVariables, continuousVariables);

const pivotOptions = function(fields) {
  return {
    aggregators: weightedAggregators('WGT'),
    hiddenFromAggregators: Object.keys(categoricalVariables),
    hiddenFromDragDrop: Object.keys(continuousVariables),
    hiddenAttributes: fields,
    rendererOptions: {
      table: {
        rowTotals: false,
        colTotals: false
      }
    },
    derivedAttributes: allVariables
  };
}

$(() => {
  Papa.parse('short.csv', {
    download: true,
    skipEmptyLines: true,
    header: true,
    complete: (parsed) => {
      $('#loading').hide();
      $('#output').pivotUI(parsed.data, pivotOptions(parsed.meta.fields));
    }
  });
});
