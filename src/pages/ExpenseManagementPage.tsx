import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, DollarSign } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Expense, expenseManagementService } from '../services/expenseManagementService';

export default function ExpenseManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [form, setForm] = useState<{ name: string; dollarValue: string; isActive: boolean }>({
    name: '',
    dollarValue: '',
    isActive: true,
  });

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      const data = await expenseManagementService.getAllExpenses();
      setExpenses(data);
    } catch (err) {
      console.error('Failed to load expenses:', err);
      setError('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const openAddForm = () => {
    setEditingExpense(null);
    setForm({ name: '', dollarValue: '', isActive: true });
    setShowForm(true);
  };

  const openEditForm = (expense: Expense) => {
    setEditingExpense(expense);
    setForm({ name: expense.name, dollarValue: String(expense.dollarValue), isActive: expense.isActive });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingExpense(null);
    setForm({ name: '', dollarValue: '', isActive: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const value = parseFloat(form.dollarValue);
    if (!form.name.trim()) {
      setError('Expense name is required');
      return;
    }
    if (isNaN(value) || value < 0) {
      setError('Enter a valid dollar value');
      return;
    }

    try {
      if (editingExpense) {
        await expenseManagementService.updateExpense(editingExpense.id, {
          name: form.name.trim(),
          dollarValue: value,
          isActive: form.isActive,
        });
        setSuccess('Expense updated successfully');
      } else {
        await expenseManagementService.addExpense({
          name: form.name.trim(),
          dollarValue: value,
          isActive: form.isActive,
          createdBy: user?.username,
        });
        setSuccess('Expense added successfully');
      }
      cancelForm();
      await loadExpenses();
    } catch (err) {
      console.error('Failed to save expense:', err);
      setError('Failed to save expense');
    }
  };

  const handleDelete = async (expense: Expense) => {
    if (!window.confirm(`Delete expense "${expense.name}"?`)) return;
    try {
      await expenseManagementService.deleteExpense(expense.id);
      setSuccess('Expense deleted successfully');
      await loadExpenses();
    } catch (err) {
      console.error('Failed to delete expense:', err);
      setError('Failed to delete expense');
    }
  };

  return (
    <div className="min-h-screen bg-yellow-100 dark:bg-black text-gray-900 dark:text-yellow-100 px-2 sm:px-4 py-4 -mx-2 sm:-mx-4 lg:mx-0 lg:p-2">
      <div className="max-w-5xl mx-auto">
        <div className="bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg shadow-xl dark:shadow-yellow-900/20 dark:shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-yellow-700 dark:bg-yellow-900 dark:bg-opacity-30 px-6 py-4 border-b border-yellow-300 dark:border-yellow-700 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-6 w-6 text-yellow-100 dark:text-yellow-300" />
              <h2 className="text-xl font-semibold text-yellow-100 dark:text-yellow-300">Expense Management</h2>
            </div>
            <button onClick={() => navigate(-1)} className="text-sm text-yellow-100 dark:text-yellow-300 hover:underline">
              Back
            </button>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 dark:bg-opacity-30 border border-red-600 rounded-lg text-red-600 dark:text-red-300">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 dark:bg-opacity-30 border border-green-600 rounded-lg text-green-700 dark:text-green-300">
                {success}
              </div>
            )}

            {!showForm && isAdmin && (
              <div className="flex justify-end mb-4">
                <button
                  onClick={openAddForm}
                  className="flex items-center space-x-2 px-4 py-2 bg-yellow-600 text-black rounded-lg hover:bg-yellow-500 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Expense</span>
                </button>
              </div>
            )}

            {showForm && (
              <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
                <h3 className="text-lg font-medium text-yellow-700 dark:text-yellow-300 mb-4">
                  {editingExpense ? 'Edit Expense' : 'Add New Expense'}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">Expense Name</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">Dollar Value</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.dollarValue}
                        onChange={(e) => setForm({ ...form, dollarValue: e.target.value })}
                        className="w-full px-3 py-2 bg-yellow-200 dark:bg-black border border-yellow-600 rounded-lg text-gray-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="expenseIsActive"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      className="rounded border-yellow-600 text-yellow-500 focus:ring-yellow-500"
                    />
                    <label htmlFor="expenseIsActive" className="text-sm text-yellow-700 dark:text-yellow-300">Active</label>
                  </div>
                  <div className="flex space-x-2">
                    <button type="submit" className="px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600 transition-colors">
                      {editingExpense ? 'Update Expense' : 'Add Expense'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelForm}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Expenses list */}
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-yellow-700 dark:text-yellow-300 mb-3">Expenses</h3>
              {loading ? (
                <div className="text-yellow-600 dark:text-yellow-400">Loading expenses...</div>
              ) : expenses.length === 0 ? (
                <div className="text-center py-8 text-yellow-600">No expenses yet. Add your first expense above.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-yellow-600 dark:bg-yellow-900 dark:bg-opacity-30">
                        <th className="px-4 py-2 text-left text-yellow-100 dark:text-yellow-300">Name</th>
                        <th className="px-4 py-2 text-right text-yellow-100 dark:text-yellow-300">Value</th>
                        <th className="px-4 py-2 text-center text-yellow-100 dark:text-yellow-300">Active</th>
                        {isAdmin && <th className="px-4 py-2 text-center text-yellow-100 dark:text-yellow-300">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map(expense => (
                        <tr key={expense.id} className="border-b border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-10">
                          <td className="px-4 py-2 font-medium text-gray-900 dark:text-yellow-100">{expense.name}</td>
                          <td className="px-4 py-2 text-right text-gray-900 dark:text-yellow-100">${expense.dollarValue.toFixed(2)}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`px-2 py-1 text-xs rounded-full ${expense.isActive ? 'bg-green-100 dark:bg-green-900 dark:bg-opacity-30 text-green-700 dark:text-green-400' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                              {expense.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-2">
                              <div className="flex space-x-1 justify-center">
                                <button onClick={() => openEditForm(expense)} className="p-1 text-yellow-600 hover:text-yellow-500" title="Edit expense">
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button onClick={() => handleDelete(expense)} className="p-1 text-red-600 hover:text-red-500" title="Delete expense">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
