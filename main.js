@@ .. @@
 // Adjusts the height of the textbox based on the amount of text
 document.addEventListener('DOMContentLoaded', function() {
   const textareas = document.querySelectorAll('textarea');
   
   textareas.forEach(textarea => {
     textarea.addEventListener('input', () => {
       textarea.style.height = 'auto'; 
       textarea.style.height = textarea.scrollHeight + 'px'; 
     });
   });
+
+  // Skip logic functionality
+  function handleSkipLogic() {
+    const elementsWithSkipLogic = document.querySelectorAll('[data-show-if]');
+    
+    elementsWithSkipLogic.forEach(element => {
+      const condition = element.getAttribute('data-show-if');
+      const shouldShow = evaluateCondition(condition);
+      
+      if (shouldShow) {
+        element.style.display = 'block';
+      } else {
+        element.style.display = 'none';
+        // Clear values in hidden elements
+        const inputs = element.querySelectorAll('input, textarea, select');
+        inputs.forEach(input => {
+          if (input.type === 'radio' || input.type === 'checkbox') {
+            input.checked = false;
+          } else {
+            input.value = '';
+          }
+        });
+      }
+    });
+  }
+
+  function evaluateCondition(condition) {
+    // Handle AND conditions (&&)
+    if (condition.includes('&&')) {
+      const parts = condition.split('&&');
+      return parts.every(part => evaluateSingleCondition(part.trim()));
+    }
+    
+    // Handle OR conditions (||)
+    if (condition.includes('||')) {
+      const parts = condition.split('||');
+      return parts.some(part => evaluateSingleCondition(part.trim()));
+    }
+    
+    // Single condition
+    return evaluateSingleCondition(condition);
+  }
+
+  function evaluateSingleCondition(condition) {
+    const [fieldName, expectedValue] = condition.split('=');
+    const field = document.querySelector(`[name="${fieldName}"]`);
+    
+    if (!field) return false;
+    
+    if (field.type === 'radio') {
+      const checkedRadio = document.querySelector(`[name="${fieldName}"]:checked`);
+      return checkedRadio && checkedRadio.value === expectedValue;
+    } else if (field.type === 'checkbox') {
+      return field.checked && expectedValue === 'yes';
+    } else {
+      return field.value === expectedValue;
+    }
+  }
+
+  // Add event listeners to all form inputs
+  const allInputs = document.querySelectorAll('input, textarea, select');
+  allInputs.forEach(input => {
+    input.addEventListener('change', handleSkipLogic);
+    input.addEventListener('input', handleSkipLogic);
+  });
+
+  // Initial skip logic evaluation
+  handleSkipLogic();
 });