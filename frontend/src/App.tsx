import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import CategoriesPage from "./pages/CategoriesPage";
import ShopPage from "./pages/ShopPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AccountPage from "./pages/AccountPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrdersPage from "./pages/OrdersPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import AdminLayout from "./pages/AdminLayout";
import AdminProductsPage from "./pages/AdminProductsPage";
import AdminInventoryPage from "./pages/AdminInventoryPage";
import AdminCategoriesPage from "./pages/AdminCategoriesPage";
import AdminVouchersPage from "./pages/AdminVouchersPage";
import AdminOrdersPage from "./pages/AdminOrdersPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import RequireAuth from "./components/RequireAuth";
import RequireAdminRoute from "./components/RequireAdminRoute";
import FloatingSocialButtons from "./components/FloatingSocialButtons";
import Layout from "./components/Layout.tsx";
import ReturnPolicyPage from "./pages/ReturnPolicyPage.tsx";
import ShippingPolicyPage from "./pages/ShippingPolicyPage.tsx";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage.tsx";
import TermsPage from "./pages/TermsPage.tsx";
import { AuthProvider } from "./contexts/AuthContext";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <FloatingSocialButtons />
        <Routes>
          {/* Chỉ 2 route này KHÔNG cần đăng nhập */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Các trang chính sách công khai (không cần đăng nhập) */}
          <Route element={<Layout />}>
            <Route
              path="/chinh-sach-doi-tra"
              element={<ReturnPolicyPage />}
            />
            <Route
              path="/chinh-sach-van-chuyen"
              element={<ShippingPolicyPage />}
            />
            <Route
              path="/chinh-sach-bao-mat"
              element={<PrivacyPolicyPage />}
            />
            <Route path="/dieu-khoan-su-dung" element={<TermsPage />} />
          </Route>

          {/* MỌI route còn lại — kể cả trang chủ — bắt buộc đăng nhập */}
          <Route element={<RequireAuth />}>
            {/* Header + Footer cố định cho mọi trang khách hàng */}
            <Route element={<Layout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/shop" element={<ShopPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route
                path="/products/:productId"
                element={<ProductDetailPage />}
              />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/:orderId" element={<OrderDetailPage />} />
            </Route>

            <Route element={<RequireAdminRoute />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminProductsPage />} />
                <Route path="products" element={<AdminProductsPage />} />
                <Route path="categories" element={<AdminCategoriesPage />} />
                <Route path="vouchers" element={<AdminVouchersPage />} />
                <Route path="orders" element={<AdminOrdersPage />} />
                <Route path="users" element={<AdminUsersPage />} />

                {/* Kho tồn hàng: chặn kép bằng RequireAdminRoute lần 2 — phòng trường hợp
                    sau này nhóm route /admin phía trên được nới cho role khác (vd STAFF),
                    riêng màn Inventory vẫn bắt buộc đúng role ADMIN. */}
                <Route element={<RequireAdminRoute />}>
                  <Route path="inventory" element={<AdminInventoryPage />} />
                </Route>
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
