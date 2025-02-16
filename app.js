const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

// Path to users.json
const usersFilePath = path.join(__dirname, '../data/workers.json');

// Variables
let users = [];
let attemptsLeft = 3; // Default number of attempts for incorrect passwords
let lockout = false; // Lockout flag
let countdownInterval; // Variable for countdown interval

// Time display function
function updateTime() {
    const timeDisplay = document.getElementById('timeDisplay');
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    if (timeDisplay) {
        timeDisplay.textContent = `${hours}:${minutes}:${seconds}`;
    }
}

// Update the time every second
setInterval(updateTime, 1000);

// Add fade-in effect on page load
window.addEventListener('DOMContentLoaded', () => {
    const loginBox = document.querySelector('.login-box');
    loginBox.style.opacity = 0;
    loginBox.style.transition = 'opacity 1.5s ease';

    // Fade in the login box
    setTimeout(() => {
        loginBox.style.opacity = 1;
    }, 100);

    // Call the time update immediately after the page is loaded
    updateTime();
});

// Handle input focus animations
document.querySelectorAll('input').forEach((input) => {
    input.addEventListener('focus', function () {
        this.style.borderColor = '#4caf50'; // Change border color on focus
        this.style.transition = 'border-color 0.3s ease';
    });

    input.addEventListener('blur', function () {
        this.style.borderColor = '#ccc'; // Revert border color on blur
    });
});

// Handle form submission for login
document.getElementById('loginForm').addEventListener('submit', function (event) {
    event.preventDefault(); // Prevent the form from submitting

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');

    // Reset error message display
    errorMessage.style.display = 'none';

    if (lockout) {
        errorMessage.textContent = 'You have to wait before trying again.';
        errorMessage.style.color = 'red';
        errorMessage.style.display = 'block';
        return;
    }

    // Send login credentials to main process
    ipcRenderer.send('validate-worker', { username, password });
});

// Listen for validation response from main process
ipcRenderer.on('validate-worker-response', (event, result) => {
    const errorMessage = document.getElementById('errorMessage');

    if (result.success) {
        errorMessage.textContent = 'Login successful! Redirecting...';
        errorMessage.style.color = 'green';
        errorMessage.style.display = 'block';
        setTimeout(() => {
            window.location.href = 'home.html'; // Redirect to the home page
        }, 1500);
    } else if (result.reason === 'invalid-password') {
        errorMessage.textContent = `Incorrect password. ${attemptsLeft} attempts left.`;
        errorMessage.style.color = 'red';
        errorMessage.style.display = 'block';
        handleFailedAttempt();
    } else if (result.reason === 'invalid-username') {
        errorMessage.textContent = 'Username does not exist.';
        errorMessage.style.color = 'red';
        errorMessage.style.display = 'block';
    }
});

// Function to handle failed login attempts
function handleFailedAttempt() {
    attemptsLeft -= 1;

    if (attemptsLeft < 0) {
        lockout = true;
        const inputs = document.querySelectorAll('input');
        const loginButton = document.querySelector('.login-button');

        inputs.forEach((input) => {
            input.disabled = true;
        });

        loginButton.disabled = true;
        document.getElementById('loginForm').style.opacity = '0.5';

        const errorMessage = document.getElementById('errorMessage');
        let secondsLeft = 30;

        errorMessage.textContent = `Too many failed attempts. Please wait ${secondsLeft} seconds.`;
        errorMessage.style.display = 'block';

        countdownInterval = setInterval(() => {
            secondsLeft -= 1;
            if (secondsLeft > 0) {
                errorMessage.textContent = `Too many failed attempts. Please wait ${secondsLeft} seconds.`;
            } else {
                clearInterval(countdownInterval);
                lockout = false;
                attemptsLeft = 3;
                inputs.forEach((input) => {
                    input.disabled = false;
                });
                loginButton.disabled = false;
                document.getElementById('loginForm').style.opacity = '1';
                errorMessage.textContent = '';
            }
        }, 1000);
    }
}

// Handle Forgot Password functionality
document.getElementById('forgotPasswordLink').addEventListener('click', function (event) {
    event.preventDefault();
    const email = document.getElementById('username').value;
    const errorMessage = document.getElementById('errorMessage');

    if (email) {
        window.location.href = `forgot-password.html?email=${encodeURIComponent(email)}`;
    } else {
        errorMessage.textContent = 'Please enter your username to retrieve your password.';
        errorMessage.style.color = 'red';
        errorMessage.style.display = 'block';
    }
});

// Handle the Exit button click to quit the app
document.getElementById('exitButton').addEventListener('click', function () {
    ipcRenderer.send('app-quit');
});
