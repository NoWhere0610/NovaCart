import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { IconCheck } from "@tabler/icons-react";
import {
  cancelOrderApi,
  completeOrderApi,
  requestReturnApi,
  getMyOrderDetailApi,
  getVnpayUrlApi,
  type OrderDto,
  type OrderStatus,
} from "../api/orderApi";
import { createReviewApi } from "../api/productApi";
import BackButton from "../components/BackButton";

const formatVnd = (n: number) => n.toLocaleString("vi-VN") + "₫";

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Chờ thanh toán",
  CONFIRMED: "Chờ vận chuyển",
  SHIPPING: "Chờ nhận hàng",
  DELIVERED: "Cần đánh giá",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã huỷ",
  RETURN_REQUESTED: "Đang xử lý trả hàng",
  RETURNED: "Đã trả hàng/hoàn tiền",
};

const FLOW_STEPS: { status: OrderStatus; label: string }[] = [
  { status: "PENDING", label: "Chờ thanh toán" },
  { status: "CONFIRMED", label: "Chờ vận chuyển" },
  { status: "SHIPPING", label: "Chờ nhận hàng" },
  { status: "DELIVERED", label: "Cần đánh giá" },
  { status: "COMPLETED", label: "Hoàn thành" },
];

function StepIcon({ done, current }: { done: boolean; current: boolean }) {
  return (
    <div
      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        done || current
          ? "border-gold-metallic-round text-white"
          : "border-2 bg-white border-stone-300 text-stone-400"
      }`}
    >
      {done ? (
        <IconCheck size={16} stroke={3} />
      ) : (
        <span className="text-xs font-semibold">{current ? "•" : ""}</span>
      )}
    </div>
  );
}

/** Thanh tiến trình trạng thái đơn hàng — ẩn khi đơn đã huỷ hoặc đang trả hàng. */
function OrderTimeline({ status }: { status: OrderStatus }) {
  const currentIndex = FLOW_STEPS.findIndex((s) => s.status === status);
  return (
    <div className="flex items-start overflow-x-auto py-2">
      {FLOW_STEPS.map((step, idx) => {
        const done = currentIndex > idx;
        const current = currentIndex === idx;
        return (
          <div key={step.status} className="flex items-center flex-1 min-w-[90px]">
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <StepIcon done={done} current={current} />
              <span
                className={`text-[11px] text-center leading-tight ${
                  current ? "text-gold-dark font-semibold" : done ? "text-stone-700" : "text-stone-400"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < FLOW_STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 -mt-5 ${done ? "bg-gold" : "bg-stone-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`text-xl leading-none cursor-pointer ${star <= value ? "text-gold-dark" : "text-stone-300"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/** Form đánh giá inline cho 1 sản phẩm trong đơn — chỉ hiện khi đơn ở trạng thái Cần đánh giá. */
function ReviewItemForm({ productId, onDone }: { productId: number; onDone: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await createReviewApi(productId, rating, comment);
      onDone();
    } catch (err: any) {
      setError(err.response?.data?.message ?? "Không thể gửi đánh giá");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs border-gold-metallic text-gold-dark hover:bg-stone-50 px-3 py-1.5 font-medium"
      >
        Đánh giá
      </button>
    );
  }

  return (
    <div className="bg-stone-50 border border-stone-200 p-3 mt-2 w-full">
      <StarPicker value={rating} onChange={setRating} />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="Chia sẻ cảm nhận của bạn..."
        className="w-full border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-stone-900 mt-2"
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      <div className="flex gap-2 mt-2">
        <button
          onClick={submit}
          disabled={submitting}
          className="text-xs bg-stone-900 border-gold-metallic gold-glow disabled:opacity-60 text-white px-3 py-1.5 font-medium"
        >
          {submitting ? "Đang gửi..." : "Gửi đánh giá"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="text-xs border border-stone-300 text-stone-600 hover:bg-white px-3 py-1.5"
        >
          Huỷ
        </button>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [payingVnpay, setPayingVnpay] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  useEffect(() => {
    if (orderId) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  function load() {
    setLoading(true);
    return getMyOrderDetailApi(Number(orderId))
      .then(setOrder)
      .finally(() => setLoading(false));
  }

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

  async function handleComplete() {
    if (!order) return;
    setCompleting(true);
    try {
      setOrder(await completeOrderApi(order.orderId));
    } catch (err: any) {
      alert(err.response?.data?.message ?? "Không thể hoàn thành đơn hàng");
    } finally {
      setCompleting(false);
    }
  }

  async function handleSubmitReturn() {
    if (!order) return;
    if (!returnReason.trim()) {
      setReturnError("Vui lòng nhập lý do trả hàng/hoàn tiền");
      return;
    }
    setReturnSubmitting(true);
    setReturnError(null);
    try {
      setOrder(await requestReturnApi(order.orderId, returnReason.trim()));
      setReturnOpen(false);
    } catch (err: any) {
      setReturnError(err.response?.data?.message ?? "Không thể gửi yêu cầu trả hàng");
    } finally {
      setReturnSubmitting(false);
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
  const needsVnpayPayment =
    order.paymentMethod === "VNPAY" &&
    order.paymentStatus === "UNPAID" &&
    (order.status === "PENDING" || order.status === "CONFIRMED");

  async function handlePayAgain() {
    if (!order) return;
    setPayingVnpay(true);
    try {
      const url = await getVnpayUrlApi(order.orderId);
      window.location.href = url;
    } catch (err: any) {
      alert(err.response?.data?.message ?? "Không thể tạo link thanh toán VNPay");
      setPayingVnpay(false);
    }
  }
  const needsReview = order.status === "DELIVERED";
  const canRequestReturn = order.status === "DELIVERED" || order.status === "COMPLETED";
  const isCancelled = order.status === "CANCELLED";
  const isReturnFlow = order.status === "RETURN_REQUESTED" || order.status === "RETURNED";

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <BackButton />
        <div className="bg-white border border-stone-200 p-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-display text-2xl font-semibold text-stone-900">
              Đơn hàng #{order.orderId}
            </h1>
            <span className="text-sm font-medium text-stone-700">
              {STATUS_LABEL[order.status]}
            </span>
          </div>

          {!isCancelled && !isReturnFlow && (
            <div className="mb-6 border-b border-stone-100 pb-6">
              <OrderTimeline status={order.status} />
            </div>
          )}

          {isCancelled && (
            <div className="mb-6 bg-stone-100 border border-stone-200 px-4 py-3 text-sm text-stone-600">
              Đơn hàng này đã bị huỷ.
            </div>
          )}

          {isReturnFlow && (
            <div className="mb-6 bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <p className="font-medium mb-1">
                {order.status === "RETURN_REQUESTED"
                  ? "Yêu cầu trả hàng/hoàn tiền đang chờ xử lý."
                  : "Đơn hàng đã được trả hàng/hoàn tiền."}
              </p>
              {order.returnReason && <p>Lý do: {order.returnReason}</p>}
            </div>
          )}

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
              {order.paymentMethod === "COD"
                ? "Khi nhận hàng"
                : order.paymentMethod === "VNPAY"
                ? `VNPay${order.paymentStatus === "PAID" ? " (đã thanh toán)" : " (chưa thanh toán)"}`
                : "Chuyển khoản"}
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
                className="flex items-center justify-between py-3 text-sm flex-wrap gap-2"
              >
                <div className="flex-1 min-w-[160px]">
                  <p className="font-medium text-stone-900">{item.productName}</p>
                  <p className="text-stone-500">
                    {item.size} / {item.color} × {item.quantity}
                  </p>
                </div>
                <p className="font-medium text-stone-900">
                  {formatVnd(item.subtotal)}
                </p>

                {needsReview && item.productId && (
                  item.reviewed ? (
                    <span className="text-xs text-green-700 font-medium">✓ Đã đánh giá</span>
                  ) : (
                    <ReviewItemForm productId={item.productId} onDone={load} />
                  )
                )}
              </div>
            ))}
          </div>

          {(order.voucherCode || order.shippingFee) && (
            <div className="mt-4 space-y-1">
              <div className="flex items-center justify-between text-sm text-stone-500">
                <span>Tạm tính</span>
                <span>
                  {formatVnd(order.subtotalAmount ?? order.totalAmount)}
                </span>
              </div>
              {order.voucherCode && (
                <div className="flex items-center justify-between text-sm text-green-700">
                  <span>Mã giảm giá ({order.voucherCode})</span>
                  <span>-{formatVnd(order.discountAmount ?? 0)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm text-stone-500">
                <span>Phí vận chuyển</span>
                <span>{formatVnd(order.shippingFee ?? 0)}</span>
              </div>
            </div>
          )}

          <div className="border-t border-stone-200 pt-4 mt-4 flex items-center justify-between">
            <span className="text-stone-600">Tổng cộng</span>
            <span className="text-xl font-semibold text-stone-900">
              {formatVnd(order.totalAmount)}
            </span>
          </div>

          {needsVnpayPayment && (
            <button
              onClick={handlePayAgain}
              disabled={payingVnpay}
              className="mt-6 w-full bg-stone-900 border-gold-metallic gold-glow disabled:opacity-60 text-white text-sm font-semibold px-6 py-3"
            >
              {payingVnpay ? "Đang chuyển tới VNPay..." : "Thanh toán qua VNPay"}
            </button>
          )}

          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="mt-6 w-full border border-red-600 text-red-600 hover:bg-red-50 disabled:opacity-60 transition-colors text-sm font-semibold px-6 py-3"
            >
              {cancelling ? "Đang huỷ..." : "Huỷ đơn hàng"}
            </button>
          )}

          {needsReview && (
            <button
              onClick={handleComplete}
              disabled={completing}
              className="mt-6 w-full bg-stone-900 border-gold-metallic gold-glow disabled:opacity-60 text-white text-sm font-semibold px-6 py-3"
            >
              {completing ? "Đang xử lý..." : "Hoàn thành đơn hàng"}
            </button>
          )}

          {canRequestReturn && !returnOpen && (
            <button
              onClick={() => setReturnOpen(true)}
              className="mt-3 w-full border border-stone-300 text-stone-700 hover:border-stone-900 transition-colors text-sm font-semibold px-6 py-3"
            >
              Yêu cầu trả hàng/hoàn tiền
            </button>
          )}

          {returnOpen && (
            <div className="mt-3 border border-stone-300 p-4">
              <p className="text-sm font-medium text-stone-700 mb-2">
                Lý do trả hàng/hoàn tiền
              </p>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                rows={3}
                placeholder="Ví dụ: sản phẩm không đúng mô tả, bị lỗi/hư hỏng..."
                className="w-full border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900"
              />
              {returnError && <p className="text-xs text-red-600 mt-1">{returnError}</p>}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleSubmitReturn}
                  disabled={returnSubmitting}
                  className="text-sm bg-stone-900 hover:bg-stone-800 disabled:opacity-60 text-white px-4 py-2 font-medium"
                >
                  {returnSubmitting ? "Đang gửi..." : "Gửi yêu cầu"}
                </button>
                <button
                  onClick={() => setReturnOpen(false)}
                  className="text-sm border border-stone-300 text-stone-600 hover:bg-stone-50 px-4 py-2"
                >
                  Huỷ
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => navigate("/orders")}
            className="mt-3 w-full text-sm text-stone-500 hover:text-stone-800 underline text-center"
          >
            Quay lại danh sách đơn hàng
          </button>
        </div>
      </div>
    </div>
  );
}