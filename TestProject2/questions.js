document.addEventListener('DOMContentLoaded', async () => {
  // --- DOM Elements ---
  const surveyContent = document.getElementById('survey-content');
  const nextButton = document.getElementById('next-button');
  const backButton = document.getElementById('back-button');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');

  // --- State ---
  let surveyConfig;
  let mainSurveyItems = [];
  let renderedElements = []; // To store references to the question elements
  let currentQuestionIndex = 0;
  let logicTriggers = new Set();
  let surveyAnswers = JSON.parse(localStorage.getItem('surveyAnswers')) || {};

  /**
   * Main initialization function.
   */
  async function initializeSurvey() {
    try {
      const response = await fetch("main.JSON"); // Fixed JSON file path
      if (!response.ok) throw new Error('Could not load survey configuration.');
      surveyConfig = await response.json();

      const mainSurveyPages = surveyConfig.questions.filter(page => page.id !== surveyConfig.startQuestionId);
      mainSurveyItems = mainSurveyPages.flatMap(page => page.items || []);

      if (mainSurveyItems.length > 0) {
        renderAllQuestionsHidden(mainSurveyPages);
        loadAnswers();
        setupEventListeners();
        updateAllConditions();
        showQuestion(0); // Show the very first question
      } else {
        throw new Error('Main survey questions could not be found.');
      }
    } catch (error) {
      console.error('Initialization failed:', error);
      surveyContent.innerHTML = `<p class="error">${error.message}</p>`;
    }
  }

  /**
   * Renders all questions from the JSON but keeps them hidden.
   */
  function renderAllQuestionsHidden(pages) {
    pages.forEach(page => {
      (page.items || []).forEach(item => {
        let element;
        switch (item.type) {
          case 'heading':
            element = document.createElement('h2');
            element.className = 'section-heading';
            element.textContent = item.text;
            break;
          case 'textarea':
          case 'text':
          case 'date':
            element = createFormGroup(item);
            break;
          case 'yesno':
            element = createYesNoGroup(item);
            break;
          case 'info':
            element = document.createElement('div');
            element.className = 'info-display';
            element.innerHTML = `<p>${item.text}</p>`;
            break;
        }
        if (element) {
          element.setAttribute('data-question-id', item.id);
          element.style.display = 'none'; // Hide all questions by default
          surveyContent.appendChild(element);
          renderedElements.push(element); // Store reference for easy access
          if (item.logic) findLogicTriggers(item.logic.condition);
        }
      });
    });
  }

  /**
   * Dynamically resizes a textarea to fit its content.
   * @param {HTMLElement} element - The textarea element.
   */
  function resizeTextarea(element) {
    element.style.height = 'auto'; // Reset height to recalculate scrollHeight
    element.style.height = (element.scrollHeight) + 'px';
  }

  // --- Element Creation Functions (createFormGroup, createYesNoGroup) ---
  function createFormGroup(item) {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    const input = document.createElement(item.type === 'textarea' ? 'textarea' : 'input');
    if (item.type !== 'textarea') input.type = item.type;
    input.id = item.id;
    input.name = item.id;

    if (item.type === 'textarea') {
      // Add event listener for auto-resizing
      input.addEventListener('input', () => resizeTextarea(input));
    }

    const label = document.createElement('label');
    label.setAttribute('for', item.id);
    label.textContent = item.text;
    formGroup.appendChild(label);
    formGroup.appendChild(input);
    if (item.help) {
      const helpText = document.createElement('p');
      helpText.className = 'help-text';
      helpText.textContent = item.help;
      formGroup.appendChild(helpText);
    }
    return formGroup;
  }

  function createYesNoGroup(item) {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = item.text;
    fieldset.appendChild(legend);
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'options-container';
    (item.options || [{
      label: 'Yes',
      value: '1'
    }, {
      label: 'No',
      value: '2'
    }]).forEach(opt => {
      const label = document.createElement('label');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = item.id;
      radio.id = `${item.id}_${opt.value}`;
      radio.value = opt.value;
      label.appendChild(radio);
      label.appendChild(document.createTextNode(opt.label));
      optionsContainer.appendChild(label);
    });
    fieldset.appendChild(optionsContainer);
    formGroup.appendChild(fieldset);
    if (item.help) {
      const helpText = document.createElement('p');
      helpText.className = 'help-text';
      helpText.textContent = item.help;
      formGroup.appendChild(helpText);
    }
    return formGroup;
  }

  /**
   * Finds and displays a specific question by index, handling skip logic.
   * @param {number} index - The index of the question to show.
   * @param {string} direction - 'forward' or 'backward'.
   */
  function showQuestion(index, direction = 'forward') {
    let nextIndex = -1;
    if (direction === 'forward') {
      for (let i = index; i < mainSurveyItems.length; i++) {
        if (isQuestionVisible(mainSurveyItems[i])) {
          nextIndex = i;
          break;
        }
      }
    } else { // backward
      for (let i = index; i >= 0; i--) {
        if (isQuestionVisible(mainSurveyItems[i])) {
          nextIndex = i;
          break;
        }
      }
    }

    if (nextIndex === -1) {
      if (direction === 'forward') {
        localStorage.setItem('surveyAnswers', JSON.stringify(surveyAnswers));
        window.location.href = 'end_page.html';
      } else {
        window.location.href = 'disclaimer.html';
      }
      return;
    }

    currentQuestionIndex = nextIndex;

    renderedElements.forEach(el => el.style.display = 'none');
    const currentElement = renderedElements[currentQuestionIndex];
    currentElement.style.display = '';

    // Auto-resize textarea on page load if it contains content
    const textarea = currentElement.querySelector('textarea');
    if (textarea && textarea.value) {
      resizeTextarea(textarea);
    }

    updateProgress();
    updateButtonStates();
  }

  /**
   * Main handler for the "Next" button.
   */
  function handleNext() {
    saveCurrentAnswer();
    updateAllConditions();
    showQuestion(currentQuestionIndex + 1, 'forward');
  }

  /**
   * Main handler for the "Back" button.
   */
  function handleBack() {
    saveCurrentAnswer(); // Save progress even when going back
    updateAllConditions();
    showQuestion(currentQuestionIndex - 1, 'backward');
  }

  // --- Utility and State Management Functions ---
  function loadAnswers() {
    for (const [id, value] of Object.entries(surveyAnswers)) {
      const radio = document.querySelector(`[name="${id}"][value="${value}"]`);
      if (radio) {
        radio.checked = true;
      } else {
        const input = document.getElementById(id);
        if (input) input.value = value;
      }
    }
  }

  function findLogicTriggers(condition) {
    if (condition.clauses) {
      condition.clauses.forEach(c => findLogicTriggers(c));
    } else {
      logicTriggers.add(condition.questionId);
    }
  }

  function setupEventListeners() {
    backButton.addEventListener('click', handleBack);
    nextButton.addEventListener('click', handleNext);
    surveyContent.addEventListener('input', updateButtonStates);
  }

  function saveCurrentAnswer() {
    const item = mainSurveyItems[currentQuestionIndex];
    if (!item || !['text', 'textarea', 'date', 'yesno'].includes(item.type)) return;
    const checkedRadio = document.querySelector(`[name="${item.id}"]:checked`);
    if (checkedRadio) {
      surveyAnswers[item.id] = checkedRadio.value;
    } else {
      const input = document.getElementById(item.id);
      if (input) surveyAnswers[item.id] = input.value;
    }
  }

  function evaluateCondition(condition) {
    const checkedRadio = document.querySelector(`input[name="${condition.questionId}"]:checked`);
    const currentValue = checkedRadio ? checkedRadio.value : (surveyAnswers[condition.questionId] || null);
    switch (condition.operator) {
      case 'equals':
        return currentValue === condition.value;
      case 'not_equals':
        return currentValue !== condition.value;
      default:
        return false;
    }
  }

  function isQuestionVisible(item) {
    if (!item.logic) return true;
    const c = item.logic.condition;
    if (c.type === 'OR') return c.clauses.some(cl => evaluateCondition(cl));
    if (c.type === 'AND') return c.clauses.every(cl => evaluateCondition(cl));
    return evaluateCondition(c);
  }

  function updateAllConditions() {
    mainSurveyItems.forEach((item, index) => {
      if (item.logic) {
        renderedElements[index].setAttribute('data-is-visible', isQuestionVisible(item));
      }
    });
  }

  /**
   * Checks if the current question is answered. Only 'yesno' is mandatory.
   * @returns {boolean} - True if the user can proceed.
   */
  function isCurrentQuestionAnswered() {
    const item = mainSurveyItems[currentQuestionIndex];
    if (!item) return true;

    if (item.type === 'yesno') {
      const checkedRadio = document.querySelector(`[name="${item.id}"]:checked`);
      return !!checkedRadio;
    }

    return true;
  }

  function updateButtonStates() {
    nextButton.disabled = !isCurrentQuestionAnswered();
    let nextVisibleIndex = -1;
    for (let i = currentQuestionIndex + 1; i < mainSurveyItems.length; i++) {
      if (isQuestionVisible(mainSurveyItems[i])) {
        nextVisibleIndex = i;
        break;
      }
    }
    nextButton.textContent = nextVisibleIndex === -1 ? 'Finish Survey ➝' : 'Next Question ➝';
  }

  function updateProgress() {
    const totalItems = mainSurveyItems.length;
    const answeredItems = Object.keys(surveyAnswers).length;
    const progress = totalItems > 0 ? (currentQuestionIndex / totalItems) * 100 : 0;
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `Step 2 of 2 - Progress: ${Math.round(progress)}%`;
  }

  // --- Start the Application ---
  initializeSurvey();
});