import { id, profileStorage } from './profile-storage.js';
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

const presets = [...document.querySelectorAll('#household-presets button')];
const rentPresets = Array.from(benchmark.options).slice(1, 5).map(option => {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = option.textContent;
  button.value = option.value;
  button.addEventListener('click', () => {
    benchmark.value = button.value;
    benchmark.dispatchEvent(new Event('change'));
  });
  return button;
});
document.querySelector('#rent-presets').append(...rentPresets);
document.querySelector('#reset-summary').addEventListener('click', () => document.querySelector('#restore-budget').click());

function showAllocation(takeHome, housing, living, savings, cushion) {
  const allocation = document.querySelector('#budget-allocation');
  allocation.hidden = takeHome <= 0 || cushion < 0;
  if (allocation.hidden) return;
  const items = allocation.querySelectorAll('li');
  const bars = allocation.querySelectorAll('.budget-bars span');
  [housing, living, savings, cushion].forEach((amount, index) => {
    const percent = (amount / takeHome * 100).toFixed(1);
    bars[index].style.width = percent + '%';
    items[index].textContent = ['Rent', 'Living', 'Savings', 'Cushion'][index] + ' (' + percent + '%)';
  });
}
for (const button of presets) {
  button.addEventListener('click', () => {
    household.value = button.dataset.value;
    household.dispatchEvent(new Event('change'));
  });
}
document.querySelector('#print-budget').addEventListener('click', () => window.print());

function showAmount(id, label, amount) {
  const value = document.createElement('strong');
  value.textContent = currency.format(amount);
  document.getElementById(id).replaceChildren(label, value);
}

function monthlyOfferBalance(amount) {
  return currency.format(Math.abs(amount)) + (amount < 0 ? ' monthly shortfall' : ' monthly cushion');
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
  const cushion = Math.round((takeHome - expenses - savings) * 100) / 100;
  const balance = document.querySelector('#remaining');
  balance.textContent = `${cushion > 0 ? '+' : ''}${currency.format(cushion)}`;
  balance.parentElement.dataset.negative = String(cushion < 0);
  document.querySelector('#gross-net').textContent = currency.format(firstTakeHome) + ' / month';
  document.querySelector('#cash-flow').textContent = cushion < 0 ? 'Monthly shortfall' : cushion > 0 ? 'Positive monthly cash flow' : 'Balanced monthly cash flow';
  showAllocation(takeHome, housing, expenses - housing, savings, cushion);
  showAmount('take-home', usingActualPay ? 'Actual take-home pay' : 'Estimated take-home pay', takeHome);
  showAmount('expense-housing', 'Rent & utilities', -housing);
  showAmount('expense-living', 'Living & commute', -(expenses - housing));
  showAmount('after-savings', 'Savings target', -savings);
  document.querySelector('#after-savings').hidden = savings === 0;
  showAmount('expenses', 'Total monthly outflow', expenses + savings);

  document.querySelector('#first-gross').textContent = currency.format(Number(values.income)) + ' / year';
  document.querySelector('#first-left').textContent = monthlyOfferBalance(firstTakeHome - expenses - savings);
  document.querySelector('#second-left').textContent = values.secondOffer === ''
    ? 'Enter an annual salary to compare.'
    : monthlyOfferBalance(Number(values.secondOffer) / 12 * netShare - expenses - savings);

  const warning = document.querySelector('#rent-warning');
  warning.textContent = housing > gross * 0.3
    ? 'Housing warning: rent and utilities exceed 30% of gross income.'
    : 'Rent and utilities are within 30% of gross income.';
  results.hidden = false;
}

const deductionsSlider = document.querySelector('#deductions-slider');
deductionsSlider.addEventListener('input', () => {
  form.elements.deductions.value = deductionsSlider.value;
});
document.querySelector('#offer-comparison').addEventListener('invalid', event => {
  event.currentTarget.open = true;
}, true);

function updateEstimate() {
  if (form.elements.deductions.value !== '') deductionsSlider.value = form.elements.deductions.value;
  for (const button of presets) button.setAttribute('aria-pressed', String(button.dataset.value === household.value));
  for (const button of rentPresets) button.setAttribute('aria-pressed', String(button.value === benchmark.value));
  const valid = form.matches(':valid');
  document.querySelector('#restore-budget').hidden = valid;
  if (valid) {
    showBudget(Object.fromEntries(new FormData(form)));
  } else {
    results.hidden = true;
    for (const id of ['gross-net', 'first-gross', 'first-left', 'second-left']) document.getElementById(id).textContent = '';
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
    profileStorage.setItem(storageKey, JSON.stringify(saved));
    status.textContent = profileStorage.notice(id ? 'Budget saved.' : 'Budget kept in this browser tab, including refreshes. Download a copy before closing the tab.');
  } catch {
    status.textContent = 'Budget calculated. This browser could not save it.';
  }
});

fillHouseholdCosts();
try {
  const saved = JSON.parse(profileStorage.getItem(storageKey));
  if (saved) {
    includeAdvanced.checked = saved.includeAdvanced ??
      ['actualPay', 'studentLoans', 'childcare', 'healthcare', 'phoneInternet', 'savings'].some(name => Boolean(saved[name]));
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
