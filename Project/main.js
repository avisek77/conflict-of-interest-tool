// "I Accept checkbox"
document.addEventListener('DOMContentLoaded', function() {
      const checkbox = document.getElementById('Terms_And_Conditions_Checkbox');
      const nextButton = document.getElementById('next-button');
      
      // Enable/disable Next button based on checkbox state
      checkbox.addEventListener('change', function() {
        nextButton.disabled = !this.checked;
      });
      
      // Handle navigation when Next button is clicked
      nextButton.addEventListener('click', function() {
        if (!this.disabled) {
          window.location.href = 'G-1.html';
        }
      });
    });

// Adjusts the height of the textbox based on the amount of text
document.addEventListener('DOMContentLoaded', function() {
  const textareas = document.querySelectorAll('textarea');
  
  textareas.forEach(textarea => {
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto'; 
      textarea.style.height = textarea.scrollHeight + 'px'; 
    });
  });

  // Skip logic functionality
  function handleSkipLogic() {
    const elementsWithSkipLogic = document.querySelectorAll('[data-show-if]');
    
    elementsWithSkipLogic.forEach(element => {
      const condition = element.getAttribute('data-show-if');
      const shouldShow = evaluateCondition(condition);
      
      if (shouldShow) {
        element.style.display = 'block';
      } else {
        element.style.display = 'none';
        // Clear values in hidden elements
        clearHiddenValues(element);
      }
    });
  }

  function evaluateCondition(condition) {
    // Handle AND conditions (&&)
    if (condition.includes('&&')) {
      const conditions = condition.split('&&');
      return conditions.every(cond => evaluateSingleCondition(cond.trim()));
    }
    
    // Handle OR conditions (||)
    if (condition.includes('||')) {
      const conditions = condition.split('||');
      return conditions.some(cond => evaluateSingleCondition(cond.trim()));
    }
    
    // Single condition
    return evaluateSingleCondition(condition);
  }

  function evaluateSingleCondition(condition) {
    const [fieldName, expectedValue] = condition.split('=');
    
    // Check radio buttons
    const radioButton = document.querySelector(`input[name="${fieldName}"][value="${expectedValue}"]`);
    if (radioButton) {
      return radioButton.checked;
    }
    
    // Check checkboxes
    const checkbox = document.querySelector(`input[name="${fieldName}"][value="${expectedValue}"]`);
    if (checkbox && checkbox.type === 'checkbox') {
      return checkbox.checked;
    }
    
    // Check text inputs
    const textInput = document.querySelector(`input[name="${fieldName}"], textarea[name="${fieldName}"], select[name="${fieldName}"]`);
    if (textInput) {
      return textInput.value === expectedValue;
    }
    
    return false;
  }

  function clearHiddenValues(element) {
    // Clear all form inputs within the hidden element
    const inputs = element.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      if (input.type === 'radio' || input.type === 'checkbox') {
        input.checked = false;
      } else {
        input.value = '';
      }
    });
  }

  // Add event listeners to all form inputs
  const allInputs = document.querySelectorAll('input, textarea, select');
  allInputs.forEach(input => {
    input.addEventListener('change', handleSkipLogic);
    input.addEventListener('input', handleSkipLogic);
  });

  // Initial evaluation
  handleSkipLogic();

  // Enhanced skip logic for complex branching based on PDF logic document
  function handleComplexSkipLogic() {
    // Question 10 branching logic
    const q10Value = getFormValue('q10');
    
    // If Q10 = "no", skip to potential conflicts section
    if (q10Value === 'no') {
      // Hide sections G-3, G-4, G-5 and show potential conflicts questions
      hideSection('g3-form');
      hideSection('g4-form');
      hideSection('g5-form');
      // Would show potential conflicts section if it exists
    }
    
    // Question 37 final assessment logic
    const q37Value = getFormValue('q37');
    
    if (q37Value === 'do_not_proceed') {
      // If "do not proceed", show completion message
      showCompletionMessage('Based on your assessment, you have decided not to proceed with this activity.');
    } else if (q37Value === 'seek_advice') {
      // If "seek advice", show recommendation to consult
      showCompletionMessage('Based on your assessment, you should seek additional advice before proceeding.');
    }
  }

  function getFormValue(fieldName) {
    // Check radio buttons
    const radioButton = document.querySelector(`input[name="${fieldName}"]:checked`);
    if (radioButton) {
      return radioButton.value;
    }
    
    // Check text inputs
    const textInput = document.querySelector(`input[name="${fieldName}"], textarea[name="${fieldName}"], select[name="${fieldName}"]`);
    if (textInput) {
      return textInput.value;
    }
    
    return null;
  }

  function hideSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
      section.style.display = 'none';
    }
  }

  function showSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
      section.style.display = 'block';
    }
  }

  function showCompletionMessage(message) {
    // Create or update completion message
    let messageDiv = document.getElementById('completion-message');
    if (!messageDiv) {
      messageDiv = document.createElement('div');
      messageDiv.id = 'completion-message';
      messageDiv.className = 'info-box';
      messageDiv.style.marginTop = '2rem';
      messageDiv.style.backgroundColor = '#e6fff2';
      messageDiv.style.border = '2px solid #a8ffb7';
      document.querySelector('.container').appendChild(messageDiv);
    }
    messageDiv.innerHTML = `<h2>Assessment Complete</h2><p>${message}</p>`;
  }

  // Add event listeners for complex logic
  const allFormInputs = document.querySelectorAll('input, textarea, select');
  allFormInputs.forEach(input => {
    input.addEventListener('change', handleComplexSkipLogic);
    input.addEventListener('input', handleComplexSkipLogic);
  });

  // Initial evaluation of complex logic
  handleComplexSkipLogic();
});