const fs = require('fs'); // Add this line to import the fs module
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const nodemailer = require('nodemailer');
const { addWorker, editWorker, deleteWorker, loadWorkers } = require('./backend/workers-backend');
const { addCustomer, editCustomer, deleteCustomer, loadCustomers } = require('./backend/customers-backend');
const { addSupplier, editSupplier, deleteSupplier, loadSuppliers } = require('./backend/suppliers-backend');
const { loadInventoryOrders, addInventoryOrder, deleteInventoryOrder } = require('./backend/inventory-orders-backend');
const {completeOrder } = require('./backend/inventory-orders-backend');
const { loadInventory } = require('./backend/inventory-backend'); // Correct import
const {updateMaterialQuantity } = require('./backend/inventory-orders-backend'); // Correct import
const { editMaterial,addMaterial, deleteMaterial} = require('./backend/inventory-backend');
const suppliersFile = path.join(__dirname, 'data/suppliers.json');

// Configure Mailgun SMTP
const transporter = nodemailer.createTransport({
    host: 'smtp.mailgun.org',
    port: 587,
    secure: false, // Use TLS
    auth: {
        user: 'postmaster@sandboxb9ceec4960dc48af8463de0a147f505d.mailgun.org',
        pass: 'f8830f2e0beeb8aafb8742c68c0fe293-826eddfb-d091ad2c',
    },
    tls: {
        rejectUnauthorized: false, // Allow self-signed certificates
    },
});

// Function to send email with login details
function sendPasswordEmail(event, email, username, password) {
    const mailOptions = {
        from: 'postmaster@sandboxb9ceec4960dc48af8463de0a147f505d.mailgun.org',  // Set the sender email properly
        to: email,
        subject: 'קפיץ הגליל - Log in details',
        text: `Here are your login details for Galil Springs:\n\nUsername: ${username}\nPassword: ${password}`
    };

    // Send email using Mailgun
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('Error occurred while sending email:', error);
            event.reply('retrieve-password-response', { success: false, message: 'Failed to send email.' });
        } else {
            console.log('Email sent: ' + info.response);
            event.reply('retrieve-password-response', { success: true, message: 'Login details have been sent to your email.' });
        }
    });
}

// Handle password retrieval
ipcMain.on('retrieve-password', (event, email) => {
    const workers = loadWorkers();  // Load workers from JSON
    const worker = workers.find(worker => worker.email === email);

    if (worker) {
        // If email found, send username and password via email and pass `event` properly
        sendPasswordEmail(event, worker.email, worker.username, worker.password); // Change here to send username and password
    } else {
        event.reply('retrieve-password-response', { success: false, message: 'Email does not exist.' });
    }
});

// Function to send email when a new worker is added
function sendWelcomeEmail(event, name, email, username, password) {
    const mailOptions = {
        from: 'postmaster@sandboxb9ceec4960dc48af8463de0a147f505d.mailgun.org',  // Replace with your sender email
        to: email,
        subject: 'קפיץ הגליל - Welcome on board',
        text: `Welcome on board, ${name}!\n\nYour login details are:\nUsername: ${username}\nPassword: ${password}`
    };

    console.log(`Attempting to send email to ${email}...`); // Debug log

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('Error occurred while sending email:', error); // Log email error
            event.reply('add-worker-email-response', { success: false, message: 'Failed to send email.' });
        } else {
            console.log('Email sent: ' + info.response);  // Log successful email sending
            event.reply('add-worker-email-response', { success: true, message: 'Welcome email sent.' });
        }
    });
}
// Create the main application window
function createWindow() {
    const win = new BrowserWindow({
        width: 1920,
        height: 1080,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        fullscreen: true,
    });

    win.loadFile(path.join(__dirname, 'pages/sign-in.html'));  // Adjusted path to load the main page
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
// Listen for the 'app-quit' event and quit the application
ipcMain.on('app-quit', () => {
    app.quit();
});


// Handle worker addition with email approval
ipcMain.on('add-worker', (event, { username, name, phone, email, password }) => {
    console.log(`Attempting to add worker: ${name}, ${email}`); // Debug log

    // First, send the email
    sendWelcomeEmail(event, name, email, username, password, (emailSuccess, message) => {
        if (emailSuccess) {
            console.log('Email sent successfully. Proceeding to add worker...');
            const result = addWorker(username, name, phone, email, password);
            event.reply('add-worker-response', { success: true, message: 'Worker added successfully.' });
        } else {
            console.log('Email sending failed. Worker will not be added.');
            event.reply('add-worker-response', { success: false, message: message });
        }
    });
});

// ========================
// Workers-Related IPC Listeners
// ========================
ipcMain.on('add-worker', (event, { username, name, phone, email, password }) => {
    const result = addWorker(username, name, phone, email, password);
    event.sender.send('add-worker-response', result);
});

ipcMain.on('edit-worker', (event, { id, username, name, phone, email, password }) => {
    const result = editWorker(id, username, name, phone, email, password);
    event.sender.send('edit-worker-response', result);
});


ipcMain.on('delete-worker', (event, { id }) => {
    const result = deleteWorker(id);
    event.sender.send('delete-worker-response', result);
});

ipcMain.on('get-workers', (event) => {
    const workers = loadWorkers();
    event.sender.send('get-workers-response', workers);
});


// Validate worker credentials
ipcMain.on('validate-worker', (event, { username, password }) => {
    const workers = loadWorkers();
    const worker = workers.find(worker => worker.username === username);

    if (worker) {
        if (worker.password === password) {
            event.reply('validate-worker-response', { success: true });
        } else {
            event.reply('validate-worker-response', { success: false, reason: 'invalid-password' });
        }
    } else {
        event.reply('validate-worker-response', { success: false, reason: 'invalid-username' });
    }
});

// ========================
// Customers-Related IPC Listeners
// ========================
ipcMain.on('add-customer', (event, { name, phone, email, notes }) => {  // Include notes here
    const result = addCustomer(name, phone, email, notes);  // Pass notes to the backend function
    event.sender.send('add-customer-response', result);
});


ipcMain.on('edit-customer', (event, { id, name, phone, email, notes }) => {  // Include notes here
    const result = editCustomer(id, name, phone, email, notes);  // Pass notes to the backend function
    event.sender.send('edit-customer-response', result);
});


ipcMain.on('delete-customer', (event, { id }) => {
    const result = deleteCustomer(id);
    event.sender.send('delete-customer-response', result);
});

ipcMain.on('get-customers', (event) => {
    const customers = loadCustomers();
    event.sender.send('get-customers-response', customers);
});

// ========================
// Suppliers-Related IPC Listeners
// ========================
ipcMain.on('add-supplier', (event, { name, phone, email, notes }) => {
    const result = addSupplier(name, phone, email, notes);  // Include notes
    event.sender.send('add-supplier-response', result);
});

ipcMain.on('edit-supplier', (event, { id, name, phone, email, notes }) => {
    const result = editSupplier(id, name, phone, email, notes);  // Include notes
    event.sender.send('edit-supplier-response', result);
});


ipcMain.on('delete-supplier', (event, { id }) => {
    const result = deleteSupplier(id);
    event.sender.send('delete-supplier-response', result);
});

ipcMain.on('get-suppliers', (event) => {
    const suppliers = loadSuppliers();
    event.sender.send('get-suppliers-response', suppliers);
});
// ========================
// Inventory-Related IPC Listeners
// ========================
ipcMain.on('get-inventory', (event) => {
    const inventory = loadInventory();
    event.sender.send('get-inventory-response', inventory);
});

ipcMain.on('add-material', (event, { name, quantity, information }) => {
    const result = addMaterial(name, quantity, information); // Use addMaterial function
    event.sender.send('add-material-response', result);
});

ipcMain.on('edit-material', (event, { id, name, quantity, information }) => {
    const result = editMaterial(id, name, quantity, information); // Pass name, quantity, and information
    event.sender.send('edit-material-response', result);
});

ipcMain.on('remove-material', (event, { id }) => {
    const result = deleteMaterial(id);
    event.sender.send('remove-material-response', result);
});

// Correct event handler for delete material
ipcMain.on('delete-material', (event, materialId) => {
    if (!materialId) {
        event.sender.send('delete-material-fail', 'Material ID is required.');
        return;
    }

    const result = deleteMaterial(materialId); // Call deleteMaterial function

    if (result.success) {
        const materialName = result.deletedMaterial && result.deletedMaterial.name ? result.deletedMaterial.name : 'Material';
        event.sender.send('delete-material-success', `${materialName} deleted successfully.`);
    } else {
        event.sender.send('delete-material-fail', result.message);
    }
});


// ========================
// Inventory Orders IPC Listeners
// ========================

// Handle loading inventory orders
ipcMain.on('get-inventory-orders', (event) => {
    const orders = loadInventoryOrders();
    event.sender.send('get-inventory-orders-response', orders);
});

// Handle fetching suppliers
ipcMain.on('get-suppliers', (event) => {
    try {
        const suppliers = loadSuppliers();
        event.sender.send('get-suppliers-response', suppliers); // Send suppliers back to the renderer
    } catch (error) {
        console.error('Error loading suppliers:', error);
        event.sender.send('get-suppliers-response', { success: false, message: 'Failed to load suppliers.' });
    }
});

// Handle fetching inventory materials
ipcMain.on('get-inventory', (event) => {
    try {
        const inventory = loadInventory();
        event.sender.send('get-inventory-response', inventory); // Send inventory data back to the renderer
    } catch (error) {
        console.error('Error loading inventory:', error);
        event.sender.send('get-inventory-response', { success: false, message: 'Failed to load inventory.' });
    }
});

// Add inventory order logic with logging for debugging
ipcMain.on('add-inventory-order', (event, { material, quantity, supplier, supplierPhone, information }) => {
    console.log('Received request to add order:', material, quantity, supplier, supplierPhone, information); // Debug log

    // Fetch supplier details from suppliers.json (instead of relying on frontend)
    const suppliers = loadSuppliers();
    const supplierDetails = suppliers.find(s => s.name === supplier);  // Find supplier by name

    if (!supplierDetails) {
        event.sender.send('add-inventory-order-response', { success: false, message: 'Supplier not found.' });
        return;
    }

    // Use supplier email from the JSON file if available
    const email = supplierDetails.email;

    // Call the backend function to add the order to the JSON file
    const newOrder = addInventoryOrder(material, quantity, supplier, supplierPhone, information);

    if (newOrder) {
        // Log the full email content before sending
        const emailContent = `
            <p>You have a new order for <strong>${quantity}</strong> units of <strong>${material}</strong>.</p>
            <p><strong>Additional Information:</strong> ${information}</p>
            <p>Please review the order and confirm as soon as possible.</p>
            <br><br>
            <p>Thanks for choosing us,</p>
            <p><strong>Galil Springs</strong><br>
            Kfar Manda - Almaabra street<br>
            050-4011578<br>
            Khalid</p>
        `;
        console.log("Full email content:", emailContent);  // Log the full content for debugging

        // Send the email
        const mailOptions = {
            from: 'postmaster@sandboxb9ceec4960dc48af8463de0a147f505d.mailgun.org',
            to: email,  // Use email from supplier details
            subject: 'Stocks order - קפיץ הגליל',
            html: emailContent  // Use the logged HTML content
        };

        // Send email to supplier
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('Error sending email:', error);
                event.sender.send('add-inventory-order-response', { success: true, message: 'Order added, but email failed.' });
            } else {
                console.log('Email sent:', info.response);
            }
        });

        // Send a response back to the renderer process with the success message
        event.sender.send('add-inventory-order-response', { success: true, order: newOrder, message: 'Order added successfully.' });
    } else {
        event.sender.send('add-inventory-order-response', { success: false, message: 'Failed to add order.' });
    }
});

ipcMain.on('delete-inventory-order', (event, orderId) => {
    console.log('Deleting order with ID:', orderId);  // Debugging log

    // Call the backend function to delete the order by ID
    const deletedOrder = deleteInventoryOrder(orderId);

    if (deletedOrder) {
        // Log the deleted order details for debugging
        console.log('Deleted order details:', deletedOrder);

        // Load the suppliers data
        const suppliersData = fs.readFileSync(suppliersFile);
        const suppliers = JSON.parse(suppliersData);

        // Find the supplier from suppliers.json by matching the supplier name
        const supplierDetails = suppliers.find(s => s.name === deletedOrder.supplier);
        
        if (supplierDetails) {
            const supplierEmail = supplierDetails.email;  // Supplier's email from suppliers.json
            const supplierName = supplierDetails.name;
            const material = deletedOrder.material;
            const quantity = deletedOrder.quantity;

            // Prepare the email content
            const cancelEmailContent = `
                <p>Dear ${supplierName},</p>
                <p>We would like to inform you that the stocks order for <strong>${quantity}</strong> units of <strong>${material}</strong> has been canceled.</p>
                <p>We apologize for any inconvenience.</p>
                <br>
                <p>Thanks for understanding,</p>
                <p><strong>Galil Springs</strong><br>
                Kfar Manda - Almaabra street<br>
                050-4011578<br>
                Khalid</p>
            `;

            // Set up email options for cancellation
            const mailOptions = {
                from: 'postmaster@sandboxb9ceec4960dc48af8463de0a147f505d.mailgun.org',
                to: supplierEmail,  // Supplier's email address
                subject: 'Stocks Order Cancellation - קפיץ הגליל',
                html: cancelEmailContent  // The email body as HTML
            };

            // Send cancellation email to the supplier
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log('Error sending cancellation email:', error);
                    event.sender.send('delete-inventory-order-response', { success: true, message: 'Order deleted, but email failed.' });
                } else {
                    console.log('Cancellation email sent:', info.response);
                    event.sender.send('delete-inventory-order-response', { success: true, message: 'Order deleted and cancellation email sent.' });
                }
            });
        } else {
            // If supplier is not found, send a success response but no email sent
            event.sender.send('delete-inventory-order-response', { success: true, message: 'Order deleted, but no email sent (supplier not found).' });
        }
    } else {
        // Send an error response if the order was not found
        event.sender.send('delete-inventory-order-response', { success: false, message: 'Failed to delete order.' });
    }
});

ipcMain.on('order-received', (event, { orderId, material, quantity }) => {
    const updatedOrder = completeOrder(orderId, material, quantity);
    if (updatedOrder) {
        event.sender.send('order-received-response', { success: true });
    } else {
        event.sender.send('order-received-response', { success: false, message: 'Order or material not found.' });
    }
});



// Function to send email for an order action (create, complete, delete)
function sendOrderEmail(order, type) {
    const customers = loadCustomers();
    const customer = customers.find(c => c.id === order.customerId);
  
    if (customer && customer.email) {
      let subject = '';
      let text = '';
      let actionDescription = '';
  
      switch (type) {
        case 'created':
          actionDescription = 'Order Created';
          subject = `קפיץ הגליל - ${actionDescription}`;
          text = `Dear ${customer.name},\n\nYour order for ${order.quantity} units of ${order.springType} has been created successfully.`;
          break;
        case 'completed':
          actionDescription = 'Order Completed';
          subject = `קפיץ הגליל - ${actionDescription}`;
          text = `Dear ${customer.name},\n\nYour order for ${order.quantity} units of ${order.springType} has been completed successfully.`;
          break;
        case 'deleted':
          actionDescription = 'Order Deleted';
          subject = `קפיץ הגליל - ${actionDescription}`;
          text = `Dear ${customer.name},\n\nYour order for ${order.quantity} units of ${order.springType} has been deleted.`;
          break;
      }
  
      // Add the footer to the email body
      const emailFooter = `
        <br><br>
        <p>Thanks for choosing us,</p>
        <p><strong>Galil Springs</strong><br>
        Kfar Manda - Almaabra street<br>
        050-4011578<br>
        Khalid</p>
      `;
  
      // Combine the message body and footer
      text += emailFooter;
  
      const mailOptions = {
        from: 'postmaster@sandboxb9ceec4960dc48af8463de0a147f505d.mailgun.org',
        to: customer.email,
        subject: subject,
        html: text // Using html format to include the footer with line breaks and HTML tags
      };
  
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log('Error sending email:', error);
        } else {
          console.log('Email sent:', info.response);
        }
      });
    }
  }
  
  // Listen for IPC event to send order emails
  ipcMain.on('send-order-email', (event, { type, order }) => {
    sendOrderEmail(order, type);
  });