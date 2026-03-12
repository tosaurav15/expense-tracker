// Sample data to make the UI look real in Phase 1
export const MOCK_SUMMARY = {
  income: 75000,
  expenses: 34200,
  savings: 40800,
  savingsRate: 54.4,
  healthScore: 78,
  currency: '₹',
};

export const MOCK_RECENT_TRANSACTIONS = [
  { id: 1, date: 'Today', amount: -350, category: 'Food', merchant: 'Swiggy', icon: '🍕', type: 'expense' },
  { id: 2, date: 'Today', amount: -1200, category: 'Groceries', merchant: 'BigBasket', icon: '🛒', type: 'expense' },
  { id: 3, date: 'Yesterday', amount: -250, category: 'Transport', merchant: 'Uber', icon: '🚗', type: 'expense' },
  { id: 4, date: 'Yesterday', amount: 75000, category: 'Salary', merchant: 'Employer', icon: '💼', type: 'income' },
  { id: 5, date: '8 Mar', amount: -499, category: 'Entertainment', merchant: 'Netflix', icon: '🎬', type: 'expense' },
  { id: 6, date: '8 Mar', amount: -3200, category: 'Shopping', merchant: 'Amazon', icon: '📦', type: 'expense' },
  { id: 7, date: '7 Mar', amount: -180, category: 'Food', merchant: 'Zomato', icon: '🍱', type: 'expense' },
  { id: 8, date: '7 Mar', amount: -599, category: 'Bills', merchant: 'Airtel', icon: '📱', type: 'expense' },
];

export const MOCK_CATEGORY_DATA = [
  { label: 'Food', value: 8400, color: '#F0A500', icon: '🍕' },
  { label: 'Shopping', value: 6200, color: '#9B5DE5', icon: '🛍️' },
  { label: 'Transport', value: 3100, color: '#4CC9F0', icon: '🚗' },
  { label: 'Bills', value: 4800, color: '#FF6B6B', icon: '💡' },
  { label: 'Entertainment', value: 2900, color: '#06D6A0', icon: '🎬' },
  { label: 'Others', value: 8800, color: '#5A6A8A', icon: '📦' },
];

export const MOCK_MONTHLY_TREND = [
  { month: 'Sep', income: 75000, expense: 38000 },
  { month: 'Oct', income: 75000, expense: 42000 },
  { month: 'Nov', income: 75000, expense: 35000 },
  { month: 'Dec', income: 75000, expense: 52000 },
  { month: 'Jan', income: 80000, expense: 40000 },
  { month: 'Feb', income: 80000, expense: 36000 },
  { month: 'Mar', income: 75000, expense: 34200 },
];

export const MOCK_INSIGHTS = [
  { id: 1, text: 'You spent 18% more on Food this month vs last month', type: 'warning', icon: '⚠️' },
  { id: 2, text: 'Great! Your savings rate of 54% beats your 3-month average', type: 'positive', icon: '🎯' },
  { id: 3, text: 'Netflix, Spotify recurring on 8th — ₹1098 upcoming', type: 'info', icon: '🔄' },
];

export const MOCK_CATEGORIES = [
  { id: 'food', name: 'Food', icon: '🍕', color: '#F0A500' },
  { id: 'transport', name: 'Transport', icon: '🚗', color: '#4CC9F0' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#9B5DE5' },
  { id: 'bills', name: 'Bills', icon: '💡', color: '#FF6B6B' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#06D6A0' },
  { id: 'salary', name: 'Salary', icon: '💼', color: '#4CC9F0' },
  { id: 'investment', name: 'Investment', icon: '📈', color: '#06D6A0' },
  { id: 'rent', name: 'Rent', icon: '🏠', color: '#FF6B6B' },
  { id: 'health', name: 'Health', icon: '❤️', color: '#FF6B6B' },
  { id: 'education', name: 'Education', icon: '📚', color: '#4CC9F0' },
];
