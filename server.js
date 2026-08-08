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
const UserSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    color: { type: String, default: '#6366f1' },
    createdAt: { type: Date, default: Date.now }
});

const CategorySchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, default: 'user-default' },
    name: { type: String, required: true },
    icon: { type: String, required: true },
    budget: { type: Number, required: true },
    color: { type: String, required: true },
    colorAlpha: { type: String, required: true }
});

const ExpenseSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, default: 'user-default' },
    amount: { type: Number, required: true },
    categoryId: { type: String, required: true },
    date: { type: String, required: true },
    description: { type: String, default: '' }
});

const SettingSchema = new mongoose.Schema({
    userId: { type: String, required: true, default: 'user-default' },
    key: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true }
});
SettingSchema.index({ userId: 1, key: 1 }, { unique: true });

const User = mongoose.model('User', UserSchema);
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
            ensureDefaultUser();
        })
        .catch(err => {
            console.error('MongoDB connection error:', err);
        });
}

// Ensure default primary user profile & seed categories
async function ensureDefaultUser() {
    try {
        // Drop legacy single-field unique index on settings if present
        try {
            await Setting.collection.dropIndex('key_1');
            console.log('Dropped legacy key_1 index on settings collection.');
        } catch (e) {
            // Index key_1 might not exist or already dropped
        }

        let userCount = await User.countDocuments();
        if (userCount === 0) {
            console.log('Creating default primary user profile...');
            await User.create({
                id: 'user-default',
                name: 'משתמש ראשי',
                color: '#6366f1',
                createdAt: new Date()
            });
        }

        // Migrate unassigned legacy entries to user-default
        await Category.updateMany({ userId: { $exists: false } }, { $set: { userId: 'user-default' } });
        await Expense.updateMany({ userId: { $exists: false } }, { $set: { userId: 'user-default' } });
        await Setting.updateMany({ userId: { $exists: false } }, { $set: { userId: 'user-default' } });

        // Seed default categories if user-default has 0 categories
        const catCount = await Category.countDocuments({ userId: 'user-default' });
        if (catCount === 0) {
            await seedCategoriesForUser('user-default');
        }
    } catch (e) {
        console.error('Error in ensureDefaultUser migration:', e);
    }
}

async function seedCategoriesForUser(userId) {
    try {
        const timestamp = Date.now();
        const defaultCategories = [
            { id: `cat-1-${timestamp}`, userId, name: 'קבועים', icon: '💳', budget: 3000, color: '#6366f1', colorAlpha: 'rgba(99, 102, 241, 0.15)' },
            { id: `cat-2-${timestamp}`, userId, name: 'מזון', icon: '🥦', budget: 1500, color: '#f59e0b', colorAlpha: 'rgba(245, 158, 11, 0.15)' },
            { id: `cat-3-${timestamp}`, userId, name: 'אוכל בחוץ', icon: '🍔', budget: 600, color: '#f43f5e', colorAlpha: 'rgba(244, 63, 94, 0.15)' },
            { id: `cat-4-${timestamp}`, userId, name: 'בגדים', icon: '🛍️', budget: 500, color: '#8b5cf6', colorAlpha: 'rgba(139, 92, 246, 0.15)' },
            { id: `cat-5-${timestamp}`, userId, name: 'פארמה', icon: '💊', budget: 300, color: '#14b8a6', colorAlpha: 'rgba(20, 184, 166, 0.15)' },
            { id: `cat-6-${timestamp}`, userId, name: 'חד פעמי', icon: '🥤', budget: 200, color: '#0ea5e9', colorAlpha: 'rgba(14, 165, 233, 0.15)' }
        ];
        await Category.insertMany(defaultCategories);
        console.log(`Categories seeded successfully for user ${userId}.`);
    } catch (e) {
        console.error(`Error seeding categories for user ${userId}:`, e);
    }
}

// --- API Endpoints ---

// Get all users
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}).sort({ createdAt: 1 });
        res.json(users);
    } catch (e) {
        console.error('Error fetching users:', e);
        res.status(500).json({ error: 'Server error fetching users' });
    }
});

// Create new user profile
app.post('/api/users', async (req, res) => {
    try {
        const { name, color } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'שם משתמש הוא שדה חובה' });
        }
        const newUser = new User({
            id: 'user-' + Date.now(),
            name: name.trim(),
            color: color || '#8b5cf6',
            createdAt: new Date()
        });
        await newUser.save();
        await seedCategoriesForUser(newUser.id);
        res.status(201).json(newUser);
    } catch (e) {
        console.error('Error creating user:', e);
        res.status(500).json({ error: 'Server error creating user' });
    }
});

// Delete user profile and all associated data
app.delete('/api/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const userCount = await User.countDocuments();
        if (userCount <= 1) {
            return res.status(400).json({ error: 'לא ניתן למחוק את המשתמש האחרון במערכת' });
        }
        const result = await User.findOneAndDelete({ id: userId });
        if (!result) {
            return res.status(404).json({ error: 'User not found' });
        }
        await Category.deleteMany({ userId });
        await Expense.deleteMany({ userId });
        await Setting.deleteMany({ userId });
        res.json({ message: 'User and all associated data deleted successfully' });
    } catch (e) {
        console.error('Error deleting user:', e);
        res.status(500).json({ error: 'Server error deleting user' });
    }
});

// Get initial scoped data for active user
app.get('/api/init', async (req, res) => {
    try {
        let users = await User.find({}).sort({ createdAt: 1 });
        if (users.length === 0) {
            await ensureDefaultUser();
            users = await User.find({}).sort({ createdAt: 1 });
        }

        let activeUserId = req.query.userId;
        if (!activeUserId || !users.some(u => u.id === activeUserId)) {
            activeUserId = users[0].id;
        }

        const categories = await Category.find({ userId: activeUserId });
        const expenses = await Expense.find({ userId: activeUserId });
        
        let billingDaySetting = await Setting.findOne({ userId: activeUserId, key: 'billingDay' });
        let billingDay = 1;
        if (billingDaySetting) {
            billingDay = parseInt(billingDaySetting.value);
        } else {
            await Setting.create({ userId: activeUserId, key: 'billingDay', value: 1 });
        }
        
        res.json({ users, activeUserId, categories, expenses, billingDay });
    } catch (e) {
        console.error('Error fetching initial data:', e);
        res.status(500).json({ error: 'Server error loading data' });
    }
});

// Add new expense scoped to user
app.post('/api/expenses', async (req, res) => {
    try {
        const { id, userId, amount, categoryId, date, description } = req.body;
        const newExpense = new Expense({ id, userId: userId || 'user-default', amount, categoryId, date, description });
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

// Add new category scoped to user
app.post('/api/categories', async (req, res) => {
    try {
        const { id, userId, name, icon, budget, color, colorAlpha } = req.body;
        const newCategory = new Category({ id, userId: userId || 'user-default', name, icon, budget, color, colorAlpha });
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
        await Expense.deleteMany({ categoryId });
        res.json({ message: 'Category and associated expenses deleted successfully' });
    } catch (e) {
        console.error('Error deleting category:', e);
        res.status(500).json({ error: 'Server error deleting category' });
    }
});

// Update billing day setting scoped to user
app.put('/api/settings', async (req, res) => {
    try {
        const { userId, billingDay } = req.body;
        const targetUserId = userId || 'user-default';
        const result = await Setting.findOneAndUpdate(
            { userId: targetUserId, key: 'billingDay' },
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
