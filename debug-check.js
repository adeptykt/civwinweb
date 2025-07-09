// Quick debug script to check current running state
console.log('Checking if dev server is running...');

// Check if dev server is accessible
fetch('http://localhost:5173')
  .then(response => {
    console.log('Dev server status:', response.status);
    console.log('Dev server is running');
  })
  .catch(error => {
    console.log('Dev server not accessible:', error.message);
  });
