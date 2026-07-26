import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import CategoriesPage from './pages/CategoriesPage'
import ShopPage from './pages/ShopPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AccountPage from './pages/AccountPage'
import ProductDetailPage from './pages/ProductDetailPage'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import OrdersPage from './pages/OrdersPage'
import OrderDetailPage from './pages/OrderDetailPage'
import AdminLayout from './pages/AdminLayout'
import AdminProductsPage from './pages/AdminProductsPage'
import AdminCategoriesPage from './pages/AdminCategoriesPage'
import AdminVouchersPage from './pages/AdminVouchersPage'
import AdminOrdersPage from './pages/AdminOrdersPage'
import AdminUsersPage from './pages/AdminUsersPage'
import RequireAuth from './components/RequireAuth'
import RequireAdminRoute from './components/RequireAdminRoute'
import FloatingSocialButtons from './components/FloatingSocialButtons'
import { AuthProvider } from './contexts/AuthContext'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <FloatingSocialButtons />
        <Routes>
          {/* Chỉ 2 route này KHÔNG cần đăng nhập */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* MỌI route còn lại — kể cả trang chủ — bắt buộc đăng nhập */}
          <Route element={<RequireAuth />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/products/:productId" element={<ProductDetailPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:orderId" element={<OrderDetailPage />} />

            <Route element={<RequireAdminRoute />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminProductsPage />} />
                <Route path="products" element={<AdminProductsPage />} />
                <Route path="categories" element={<AdminCategoriesPage />} />
                <Route path="vouchers" element={<AdminVouchersPage />} />
                <Route path="orders" element={<AdminOrdersPage />} />
                <Route path="users" element={<AdminUsersPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App