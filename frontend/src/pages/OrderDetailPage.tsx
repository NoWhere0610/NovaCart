import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  cancelOrderApi,
  getMyOrderDetailApi,
  type OrderDto,
} from "../api/orderApi";
import BackButton from "../components/BackButton";

const formatVnd = (n: number) => n.toLocaleString("vi-VN") + "₫";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  SHIPPING: "Đang giao",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã huỷ",
};

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (orderId) {
      getMyOrderDetailApi(Number(orderId))
        .then(setOrder)
        .finally(() => setLoading(false));
    }
  }, [orderId]);

  async function handleCancel() {
    if (!order || !confirm("Bạn chắc chắn muốn huỷ đơn hàng này?")) return;
    setCancelling(true);
    try {
      setOrder(await cancelOrderApi(order.orderId));
    } catch (err: any) {
      alert(err.response?.data?.message ?? "Không thể huỷ đơn hàng");
    } finally {
      setCancelling(false);
    }
  }

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-stone-500">
        Đang tải...
      </div>
    );
  if (!order)
    return (
      <div className="min-h-screen flex items-center justify-center text-stone-500">
        Không tìm thấy đơn hàng
      </div>
    );

  const canCancel = order.status === "PENDING" || order.status === "CONFIRMED";

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <BackButton />
        <div className="bg-white border border-stone-200 p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-stone-900">
            Đơn hàng #{order.orderId}
          </h1>
          <span className="text-sm font-medium text-stone-700">
            {STATUS_LABEL[order.status]}
          </span>
        </div>

        <div className="text-sm text-stone-600 mb-6 space-y-1">
          <p>
            <span className="text-stone-400">Người nhận:</span>{" "}
            {order.receiverName} — {order.phone}
          </p>
          <p>
            <span className="text-stone-400">Địa chỉ:</span>{" "}
            {order.shippingAddress}
          </p>
          <p>
            <span className="text-stone-400">Thanh toán:</span>{" "}
            {order.paymentMethod === "COD" ? "Khi nhận hàng" : "Chuyển khoản"}
          </p>
          {order.note && (
            <p>
              <span className="text-stone-400">Ghi chú:</span> {order.note}
            </p>
          )}
        </div>

        <div className="border-t border-stone-200 divide-y divide-stone-100">
          {order.items?.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between py-3 text-sm"
            >
              <div>
                <p className="font-medium text-stone-900">{item.productName}</p>
                <p className="text-stone-500">
                  {item.size} / {item.color} × {item.quantity}
                </p>
              </div>
              <p className="font-medium text-stone-900">
                {formatVnd(item.subtotal)}
              </p>
            </div>
          ))}
        </div>

        {order.voucherCode && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-stone-500 mb-1">
              <span>Tạm tính</span>
              <span>
                {formatVnd(order.subtotalAmount ?? order.totalAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm text-green-700">
              <span>Mã giảm giá ({order.voucherCode})</span>
              <span>-{formatVnd(order.discountAmount ?? 0)}</span>
            </div>
          </div>
        )}

        <div className="border-t border-stone-200 pt-4 mt-4 flex items-center justify-between">
          <span className="text-stone-600">Tổng cộng</span>
          <span className="text-xl font-semibold text-stone-900">
            {formatVnd(order.totalAmount)}
          </span>
        </div>

        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="mt-6 w-full border border-red-600 text-red-600 hover:bg-red-50 disabled:opacity-60 transition-colors text-sm font-semibold px-6 py-3"
          >
            {cancelling ? "Đang huỷ..." : "Huỷ đơn hàng"}
          </button>
        )}
      </div>
      </div>
    </div>
  );
}