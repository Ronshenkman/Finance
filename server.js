const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Configure environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, './')));

// MongoDB Schemas
const CategorySchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    icon: { type: String, required: true },
    budget: { type: Number, required: true },
    color: { type: String, required: true },
    colorAlpha: { type: String, required: true }
});

const ExpenseSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    categoryId: { type: String, required: true },
    date: { type: String, required: true },
    description: { type: String, required: true }
});

const SettingSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true }
});

const Category = mongoose.model('Category', CategorySchema);
const Expense = mongoose.model('Expense', ExpenseSchema);
const Setting = mongoose.model('Setting', SettingSchema);

// Connect to MongoDB
const dbUri = process.env.MONGODB_URI;
if (!dbUri) {
    console.error('ERROR: MONGODB_URI is not defined in the .env file.');
    console.log('Please configure your MongoDB Atlas connection string in the .env file to run the server.');
} else {
    mongoose.connect(dbUri, { useNewUrlParser: true, useUnifiedTopology: true })
        .then(() => {
            console.log('Successfully connected to MongoDB.');
            seedCategories();
        })
        .catch(err => {
            console.error('MongoDB connection error:', err);
        });
}

// Function to seed default categories if database is empty
async function seedCategories() {
    try {
        const count = await Category.countDocuments();
        if (count === 0) {
            console.log('Seeding default categories...');
            const defaultCategories = [
                { id: 'cat-1', name: 'קבועים', icon: '💳', budget: 3000, color: '#6366f1', colorAlpha: 'rgba(99, 102, 241, 0.15)' },
                { id: 'cat-2', name: 'מזון', icon: '🥦', budget: 1500, color: '#f59e0b', colorAlpha: 'rgba(245, 158, 11, 0.15)' },
                { id: 'cat-3', name: 'אוכל בחוץ', icon: '🍔', budget: 600, color: '#f43f5e', colorAlpha: 'rgba(244, 63, 94, 0.15)' },
                { id: 'cat-4', name: 'בגדים', icon: '🛍️', budget: 500, color: '#8b5cf6', colorAlpha: 'rgba(139, 92, 246, 0.15)' },
                { id: 'cat-5', name: 'פארמה', icon: '💊', budget: 300, color: '#14b8a6', colorAlpha: 'rgba(20, 184, 166, 0.15)' },
                { id: 'cat-6', name: 'חד פעמי', icon: '🥤', budget: 200, color: '#0ea5e9', colorAlpha: 'rgba(14, 165, 233, 0.15)' }
            ];
            await Category.insertMany(defaultCategories);
            console.log('Default categories seeded successfully.');
        }
    } catch (e) {
        console.error('Error seeding default categories:', e);
    }
}

// --- API Endpoints ---

// Get all initial data (categories, expenses, billing settings)
app.get('/api/init', async (req, res) => {
    try {
        const categories = await Category.find({});
        const expenses = await Expense.find({});
        
        let billingDaySetting = await Setting.findOne({ key: 'billingDay' });
        let billingDay = 1;
        if (billingDaySetting) {
            billingDay = parseInt(billingDaySetting.value);
        } else {
            // Initialize billingDay in DB to default 1
            await Setting.create({ key: 'billingDay', value: 1 });
        }
        
        res.json({ categories, expenses, billingDay });
    } catch (e) {
        console.error('Error fetching initial data:', e);
        res.status(500).json({ error: 'Server error loading data' });
    }
});

// Add new expense
app.post('/api/expenses', async (req, res) => {
    try {
        const { id, amount, categoryId, date, description } = req.body;
        const newExpense = new Expense({ id, amount, categoryId, date, description });
        await newExpense.save();
        res.status(201).json(newExpense);
    } catch (e) {
        console.error('Error adding expense:', e);
        res.status(500).json({ error: 'Server error adding expense' });
    }
});

// Delete expense
app.delete('/api/expenses/:id', async (req, res) => {
    try {
        const result = await Expense.findOneAndDelete({ id: req.params.id });
        if (!result) {
            return res.status(404).json({ error: 'Expense not found' });
        }
        res.json({ message: 'Expense deleted successfully' });
    } catch (e) {
        console.error('Error deleting expense:', e);
        res.status(500).json({ error: 'Server error deleting expense' });
    }
});

// Add new category
app.post('/api/categories', async (req, res) => {
    try {
        const { id, name, icon, budget, color, colorAlpha } = req.body;
        const newCategory = new Category({ id, name, icon, budget, color, colorAlpha });
        await newCategory.save();
        res.status(201).json(newCategory);
    } catch (e) {
        console.error('Error adding category:', e);
        res.status(500).json({ error: 'Server error adding category' });
    }
});

// Update category budget
app.put('/api/categories/:id', async (req, res) => {
    try {
        const { budget } = req.body;
        const result = await Category.findOneAndUpdate(
            { id: req.params.id },
            { budget },
            { new: true }
        );
        if (!result) {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.json(result);
    } catch (e) {
        console.error('Error updating category budget:', e);
        res.status(500).json({ error: 'Server error updating category budget' });
    }
});

// Delete category and cascade delete associated expenses
app.delete('/api/categories/:id', async (req, res) => {
    try {
        const categoryId = req.params.id;
        const catResult = await Category.findOneAndDelete({ id: categoryId });
        if (!catResult) {
            return res.status(404).json({ error: 'Category not found' });
        }
        // Cascade delete expenses
        await Expense.deleteMany({ categoryId });
        res.json({ message: 'Category and associated expenses deleted successfully' });
    } catch (e) {
        console.error('Error deleting category:', e);
        res.status(500).json({ error: 'Server error deleting category' });
    }
});

// Update billing day setting
app.put('/api/settings', async (req, res) => {
    try {
        const { billingDay } = req.body;
        const result = await Setting.findOneAndUpdate(
            { key: 'billingDay' },
            { value: parseInt(billingDay) },
            { new: true, upsert: true }
        );
        res.json({ message: 'Settings updated successfully', billingDay: result.value });
    } catch (e) {
        console.error('Error updating billing settings:', e);
        res.status(500).json({ error: 'Server error updating settings' });
    }
});

// Serve frontend on any non-API route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server (only if running locally, not in Vercel serverless environment)
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        console.log(`Open http://localhost:${PORT} in your browser to view the application.`);
    });
}

module.exports = app;
