const resultsContainer = document.getElementById('test-results');

function createResultElement(description, isSuccess, error = null) {
  const p = document.createElement('p');
  p.classList.add('test-result');
  if (isSuccess) {
    p.classList.add('success');
    p.innerHTML = `&#10004;&nbsp;&nbsp;&nbsp;${description}`;
    p.title = 'Passed';
    window.dispatchEvent(new CustomEvent("test-result", { detail: { pass: true } }));
  } else {
    p.classList.add('failure');
    p.innerHTML = `&#10006;&nbsp;&nbsp;&nbsp;${description}`;
    p.title = 'Failed';
    if (error) {
      const pre = document.createElement('pre');
      pre.textContent = error.stack || error.message;
      p.appendChild(pre);
    }
    window.dispatchEvent(new CustomEvent("test-result", { detail: { pass: false } }));
  }
  resultsContainer.appendChild(p);
}

const root = document.createElement("div");
document.body.appendChild(root);

export async function it(description, testFunction) {
  try {
    await testFunction();
    createResultElement(description, true);
  } catch (e) {
    createResultElement(description, false, e);
  } finally {
    root.innerText = "";
  }
}

export function assertEqual(actual, expected) {
  if (actual !== expected) {
    throw new Error(`Expected ${expected} but got ${actual}`);
  }
}

export function mount(el) {
  root.appendChild(el);
}


export function wait() {
  return new Promise(r => setTimeout(r, 10));
}

let totalTests = 0;
let passedTests = 0;
const resultsSummary = document.querySelector("#results-summary");
window.addEventListener("test-result", e => {
  if (e.detail.pass) {
    passedTests++;
  }
  totalTests++;
  resultsSummary.textContent = `Tests completed: ${passedTests} / ${totalTests} passed.`;
  if (passedTests === totalTests) {
    resultsSummary.style.color = 'green';
  } else {
    resultsSummary.style.color = 'red';
  }
});

import("/tests/element.js");
