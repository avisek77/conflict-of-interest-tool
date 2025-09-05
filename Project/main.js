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
});