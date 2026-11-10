const storageKey = 'commencely-budget-v1';
const form = document.querySelector('#budget-form');
const results = document.querySelector('#budget-results');
const status = document.querySelector('#budget-status');
const benchmark = document.querySelector('#benchmark');
const household = form.elements.household;
const includeAdvanced = form.elements.includeAdvanced;
const advancedFields = document.querySelector('#advanced-fields');
const estimateButtons = advancedFields.querySelectorAll('[data-budget-estimate]');
const estimateFeedback = document.querySelector('#estimate-feedback');
const optionalExpenses = ['childcare', 'healthcare', 'phoneInternet'];
// Annual costs from the Living Wage Institute's 2026 Fayetteville–Springdale–Rogers table.
const householdCosts = {
  '1-0': { food: 4159, transport: 9701, housing: 12146, healthcare: 3376, phoneInternet: 1592 },
  '1-1': { food: 6102, transport: 11226, housing: 16247, healthcare: 8731, phoneInternet: 1592 },
  '1-2': { food: 9142, transport: 14141, housing: 16247, healthcare: 8879, phoneInternet: 1592 },
  '1-3': { food: 12167, transport: 16272, housing: 22592, healthcare: 9040, phoneInternet: 1592 },
  '2-0': { food: 7626, transport: 11226, housing: 13449, healthcare: 8144, phoneInternet: 2165 },
  '2-1': { food: 9464, transport: 14141, housing: 16247, healthcare: 9658, phoneInternet: 2165 },
  '2-2': { food: 12173, transport: 16272, housing: 16247, healthcare: 9958, phoneInternet: 2165 },
  '2-3': { food: 14852, transport: 18217, housing: 22592, healthcare: 10294, phoneInternet: 2165 }
};
const annualChildcare = [0, 11457, 22289, 29277];
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function balanceText(amount, suffix = '') {
  return amount < 0
    ? `Monthly shortfall${suffix}: ${currency.format(-amount)}`
    : `Money remaining${suffix}: ${currency.format(amount)}`;
}

function showBudget(values) {
  const gross = Number(values.income) / 12;
  const housing = Number(values.housing);
  const netShare = 1 - Number(values.deductions) / 100;
  const firstTakeHome = gross * netShare;
  const usingActualPay = Boolean(values.actualPay);
  const takeHome = usingActualPay
    ? Number(values.actualPay) * Number(values.payFrequency) / 12
    : firstTakeHome;
  const expenseNames = ['housing', 'food', 'transport', 'other', 'studentLoans'];
  const selectedExpenses = optionalExpenses.filter(name => values[`${name}Included`] === 'on');
  const expenses = [...expenseNames, ...selectedExpenses].reduce((total, name) => total + Number(values[name] ?? 0), 0);
  const savings = Number(values.savings ?? 0);
  const remaining = Math.round((takeHome - expenses) * 100) / 100;

  document.querySelector('#take-home').textContent =
    `${usingActualPay ? 'Monthly take-home pay (from your paychecks)' : 'Estimated take-home pay'}: ${currency.format(takeHome)}`;
  document.querySelector('#expenses').textContent = `Total expenses: ${currency.format(expenses)}`;
  document.querySelector('#remaining').textContent = balanceText(remaining);
  const afterSavings = document.querySelector('#after-savings');
  afterSavings.hidden = savings === 0;
  afterSavings.textContent = balanceText(Math.round((takeHome - expenses - savings) * 100) / 100, ' after savings');

  const comparison = document.querySelector('#offer-comparison');
  comparison.hidden = !values.secondOffer;
  if (!comparison.hidden) {
    const secondTakeHome = Number(values.secondOffer) / 12 * netShare;
    document.querySelector('#first-take-home').textContent = currency.format(firstTakeHome);
    document.querySelector('#second-take-home').textContent = currency.format(secondTakeHome);
    document.querySelector('#first-left').textContent = currency.format(firstTakeHome - expenses - savings);
    document.querySelector('#second-left').textContent = currency.format(secondTakeHome - expenses - savings);
  }

  const warning = document.querySelector('#rent-warning');
  warning.textContent = housing > gross * 0.3
    ? 'Housing warning: rent and utilities exceed 30% of gross income.'
    : 'Rent and utilities are within 30% of gross income.';
  results.hidden = false;
}

function updateEstimate() {
  if (form.matches(':valid')) {
    showBudget(Object.fromEntries(new FormData(form)));
  } else {
    results.hidden = true;
  }
}

function fillHouseholdCosts() {
  const costs = householdCosts[household.value];
  if (!costs) return;
  for (const [name, annualCost] of Object.entries(costs)) {
    form.elements[name].value = (annualCost / 12).toFixed(2);
  }
}

function updateAdvancedOptions() {
  estimateFeedback.textContent = '';
  advancedFields.disabled = !includeAdvanced.checked;
  advancedFields.hidden = !includeAdvanced.checked;
  const costs = householdCosts[household.value];
  for (const button of estimateButtons) {
    const name = button.dataset.budgetEstimate;
    const annual = name === 'childcare' ? annualChildcare[Number(household.value.at(-1))] : costs?.[name];
    button.hidden = !costs || annual === undefined;
    if (!button.hidden) {
      button.value = (annual / 12).toFixed(2);
      button.textContent = `Use ${button.dataset.label} estimate (${currency.format(Number(button.value))}/month)`;
    }
  }
}

for (const button of estimateButtons) {
  button.addEventListener('click', () => {
    const name = button.dataset.budgetEstimate;
    const field = form.elements[name];
    field.value = button.value;
    form.elements[`${name}Included`].checked = true;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    button.after(estimateFeedback);
    estimateFeedback.textContent = `Added ${currency.format(field.valueAsNumber)} per month. You can edit the amount above.`;
  });
}

household.addEventListener('change', () => {
  if (householdCosts[household.value]) benchmark.value = '';
  fillHouseholdCosts();
  updateAdvancedOptions();
  status.textContent = '';
  updateEstimate();
});

benchmark.addEventListener('change', () => {
  if (benchmark.value) form.elements.housing.value = benchmark.value;
  status.textContent = '';
  updateEstimate();
});

form.addEventListener('input', event => {
  if (event.target === benchmark || event.target === household) return;
  estimateFeedback.textContent = '';
  if (event.target === includeAdvanced) updateAdvancedOptions();
  if (event.target === form.elements.housing) benchmark.value = '';
  status.textContent = '';
  updateEstimate();
});

document.querySelector('#restore-budget').addEventListener('click', () => {
  form.reset();
  fillHouseholdCosts();
  updateAdvancedOptions();
  status.textContent = 'Starting values restored. Save budget to keep them.';
  updateEstimate();
});

const advanced = document.querySelector('#advanced-budget');
advanced.addEventListener('invalid', () => {
  advanced.open = true;
}, true);

form.addEventListener('submit', event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  showBudget(values);
  try {
    const saved = { ...values, includeAdvanced: includeAdvanced.checked };
    for (const field of advancedFields.querySelectorAll('input, select')) {
      saved[field.name] = field.type === 'checkbox' ? field.checked : field.value;
    }
    localStorage.setItem(storageKey, JSON.stringify(saved));
    status.textContent = 'Budget saved.';
  } catch {
    status.textContent = 'Budget calculated. This browser could not save it.';
  }
});

fillHouseholdCosts();
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved) {
    includeAdvanced.checked = saved.includeAdvanced ??
      ['actualPay', 'studentLoans', 'childcare', 'healthcare', 'phoneInternet', 'savings', 'secondOffer'].some(name => Boolean(saved[name]));
    if (Object.hasOwn(householdCosts, saved.household) || saved.household === 'custom') {
      household.value = saved.household;
    } else {
      household.value = 'custom';
    }
    for (const [name, value] of Object.entries(saved)) {
      const field = form.elements.namedItem(name);
      if (field instanceof HTMLInputElement && typeof value === 'string') field.value = value;
    }
    for (const name of optionalExpenses) {
      const key = `${name}Included`;
      form.elements[key].checked = saved[key] === true;
    }
    const payFrequency = form.elements.payFrequency;
    if (Array.from(payFrequency.options).some(option => option.value === saved.payFrequency)) {
      payFrequency.value = saved.payFrequency;
    }
    const savedBenchmark = saved.housingBenchmark;
    if (savedBenchmark && Number(savedBenchmark) === form.elements.housing.valueAsNumber) {
      benchmark.value = savedBenchmark;
    }
  }
} catch {
  status.textContent = 'This browser could not load the saved budget.';
}

updateAdvancedOptions();
updateEstimate();
