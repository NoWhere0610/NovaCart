import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyCartApi, type CartDto } from "../api/cartApi";
import { getMyAddressesApi, type AddressDto } from "../api/addressApi";
import { checkoutApi, type PaymentMethod } from "../api/orderApi";
import BackButton from "../components/BackButton";

const formatVnd = (n: number) => n.toLocaleString("vi-VN") + "₫";

export default function CheckoutPage() {
  const navigate = useNavigate();

  const [cart, setCart] = useState<CartDto | null>(null);
  const [addresses, setAddresses] = useState<AddressDto[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(
    null,
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voucherCode, setVoucherCode] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [cartData, addressData] = await Promise.all([
        getMyCartApi(),
        getMyAddressesApi(),
      ]);
      setCart(cartData);
      setAddresses(addressData);
      // Tự chọn sẵn địa chỉ mặc định (is_default) nếu có, để user không phải chọn lại
      const defaultAddr =
        addressData.find((a) => a.isDefault) ?? addressData[0];
      setSelectedAddressId(defaultAddr?.addressId ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!selectedAddressId) {
      setError("Vui lòng chọn địa chỉ giao hàng");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const order = await checkoutApi({
        addressId: selectedAddressId,
        paymentMethod,
        note: note || undefined,
        voucherCode: voucherCode.trim() || undefined,
      });
      // Đặt hàng xong -> điều hướng thẳng tới trang chi tiết đơn vừa tạo
      navigate(`/orders/${order.orderId}`, { replace: true });
    } catch (err: any) {
      setError(
        err.response?.data?.message ?? "Đặt hàng thất bại, vui lòng thử lại",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-stone-500">
        Đang tải...
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-stone-500">
        <p>Giỏ hàng trống, không thể đặt hàng.</p>
        <button
          onClick={() => navigate("/")}
          className="text-orange-700 underline"
        >
          Về trang chủ
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-10">
      <div className="max-w-2xl mx-auto mb-2">
        <BackButton />
      </div>
      <div className="max-w-2xl mx-auto bg-white border border-stone-200 p-8">
        <h1 className="text-2xl font-semibold text-stone-900 mb-6">
          Xác nhận đặt hàng
        </h1>

        {error && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">
            {error}
          </div>
        )}

        <h2 className="text-sm font-semibold text-stone-700 mb-2">
          Địa chỉ giao hàng
        </h2>
        {addresses.length === 0 ? (
          <p className="text-sm text-stone-500 mb-4">
            Bạn chưa có địa chỉ nào.{" "}
            <a href="/account" className="text-orange-700 underline">
              Thêm địa chỉ
            </a>
          </p>
        ) : (
          <div className="space-y-2 mb-6">
            {addresses.map((addr) => (
              <label
                key={addr.addressId}
                className={`flex items-start gap-3 border px-4 py-3 text-sm cursor-pointer ${
                  selectedAddressId === addr.addressId
                    ? "border-stone-900"
                    : "border-stone-200"
                }`}
              >
                <input
                  type="radio"
                  name="address"
                  checked={selectedAddressId === addr.addressId}
                  onChange={() => setSelectedAddressId(addr.addressId)}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-stone-900">
                    {addr.receiverName} — {addr.phone}
                  </p>
                  <p className="text-stone-500">{addr.detailAddress}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        <h2 className="text-sm font-semibold text-stone-700 mb-2">
          Phương thức thanh toán
        </h2>
        <div className="flex gap-3 mb-6">
          {(["COD", "BANK_TRANSFER"] as PaymentMethod[]).map((method) => (
            <label
              key={method}
              className={`flex-1 border px-4 py-3 text-sm text-center cursor-pointer ${
                paymentMethod === method
                  ? "border-stone-900"
                  : "border-stone-200"
              }`}
            >
              <input
                type="radio"
                name="payment"
                className="hidden"
                checked={paymentMethod === method}
                onChange={() => setPaymentMethod(method)}
              />
              {method === "COD"
                ? "Thanh toán khi nhận hàng"
                : "Chuyển khoản ngân hàng"}
            </label>
          ))}
        </div>

        <textarea
          placeholder="Ghi chú cho đơn hàng (không bắt buộc)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900 mb-6"
          rows={2}
        />

        <h2 className="text-sm font-semibold text-stone-700 mb-2">
          Mã giảm giá (không bắt buộc)
        </h2>
        <input
          placeholder="Nhập mã giảm giá, vd: GIAM10"
          value={voucherCode}
          onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
          className="w-full border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900 mb-6"
        />
        {voucherCode && (
          <p className="text-xs text-stone-400 mb-2">
            Mã giảm giá sẽ được kiểm tra và trừ trực tiếp vào tổng tiền khi bấm
            Đặt hàng.
          </p>
        )}

        <div className="border-t border-stone-200 pt-4 mb-6 flex items-center justify-between">
          <span className="text-stone-600">Tổng thanh toán</span>
          <span className="text-xl font-semibold text-stone-900">
            {formatVnd(cart.totalAmount)}
          </span>
        </div>

        <button
          onClick={handleConfirm}
          disabled={submitting || addresses.length === 0}
          className="w-full bg-orange-700 hover:bg-orange-600 disabled:opacity-60 transition-colors text-stone-50 text-sm font-semibold px-6 py-3"
        >
          {submitting ? "Đang xử lý..." : "Đặt hàng"}
        </button>
      </div>
    </div>
  );
}