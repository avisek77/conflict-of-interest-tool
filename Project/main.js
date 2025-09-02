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
});