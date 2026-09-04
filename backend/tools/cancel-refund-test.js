const { execFileSync } = require('child_process');
const api = 'http://localhost:8080/api';
const sq = (c) => execFileSync('sqlcmd', ['-S','localhost,1433','-U','sa','-P','123456','-d','menswear_shop','-C','-h','-1','-W','-Q',c], {encoding:'utf8'});
const goi = async (p, {method='GET', body, token}={}) => {
  const h={}; if(body) h['Content-Type']='application/json'; if(token) h.Authorization=`Bearer ${token}`;
  const r = await fetch(api+p, {method, headers:h, body: body?JSON.stringify(body):undefined});
  let d=null; try{ d=await r.json(); }catch{}
  return {http:r.status, body:d};
};
(async () => {
  const t=Date.now(), u=`kiemlai${t}`;
  const dk = await goi('/auth/register',{method:'POST',body:{username:u,password:'matkhau123',email:`${u}@example.invalid`,fullName:'Kiem lai'}});
  const token=dk.body.accessToken, uid=dk.body.userId;
  const mk = (ma, pm, ps) => { sq(`INSERT INTO orders (user_id,order_code,total_amount,subtotal_amount,discount_amount,status,payment_method,payment_status,order_type,shipping_fee,version,refund_status,created_at,phone,receiver_name,shipping_address) VALUES (${uid},'${ma}',900000,900000,0,'PENDING','${pm}','${ps}','ONLINE',0,0,'NONE',SYSDATETIME(),'0912345678',N'Kiem lai',N'Ha Noi');`);
    return Number(sq(`SELECT order_id FROM orders WHERE order_code='${ma}';`).trim().split('\n')[0].trim()); };

  const idPaid = mk(`KL1${t}`,'VNPAY','PAID');
  const idCod  = mk(`KL2${t}`,'COD','UNPAID');
  let dat=0, truot=0;
  const kiem=(ten,dk,ct='')=>{ if(dk){dat++;console.log(`  ✔ ${ten}`);} else {truot++;console.log(`  ✖ ${ten}\n      ${ct}`);} };

  console.log('\n  --- Đơn VNPay ĐÃ trả 900.000đ ---');
  const khongKhai = await goi(`/orders/${idPaid}/cancel`,{method:'POST',token,body:{}});
  kiem('Huỷ mà không khai tài khoản -> bị chặn', khongKhai.http===400, `HTTP ${khongKhai.http}: ${JSON.stringify(khongKhai.body)}`);
  const stt = sq(`SELECT status FROM orders WHERE order_id=${idPaid};`).trim().split('\n')[0].trim();
  kiem('Bị chặn thì đơn KHÔNG bị huỷ nửa vời', stt==='PENDING', `đang là ${stt}`);

  const khai = await goi(`/orders/${idPaid}/cancel`,{method:'POST',token,body:{refundBankName:'Vietcombank (Ngoại thương)',refundAccountNumber:'1234 5678 9012',refundAccountHolder:'NGUYEN VAN A'}});
  kiem('Khai đủ -> huỷ được', khai.http===200 && khai.body?.status==='CANCELLED', `HTTP ${khai.http}`);
  kiem('Đơn VÀO hàng chờ chuyển tiền (trước đây: 0 đơn)', khai.body?.refundStatus==='PENDING', `refundStatus=${khai.body?.refundStatus}`);
  kiem('Giữ đúng dấu tiếng Việt tên ngân hàng', khai.body?.refundBankName==='Vietcombank (Ngoại thương)', `${khai.body?.refundBankName}`);
  kiem('Số tài khoản được dọn dấu cách', khai.body?.refundAccountNumber==='123456789012', `${khai.body?.refundAccountNumber}`);

  console.log('\n  --- Đơn COD chưa giao ---');
  const cod = await goi(`/orders/${idCod}/cancel`,{method:'POST',token,body:{}});
  kiem('Huỷ bình thường, KHÔNG đòi tài khoản', cod.http===200 && cod.body?.status==='CANCELLED', `HTTP ${cod.http}: ${JSON.stringify(cod.body?.message)}`);
  kiem('Không sinh khoản phải hoàn', cod.body?.refundStatus==='NONE', `refundStatus=${cod.body?.refundStatus}`);

  console.log('\n  --- Admin ---');
  const dnA = await goi('/auth/login',{method:'POST',body:{usernameOrEmail:'admin',password:'admin@123'}});
  const ta = dnA.body.accessToken;
  const xn = await goi(`/admin/orders/${idPaid}/confirm-refund`,{method:'PATCH',token:ta});
  kiem('Admin xác nhận đã chuyển tiền cho đơn ĐÃ HUỶ', xn.http===200 && xn.body?.refundStatus==='COMPLETED', `HTTP ${xn.http}: ${JSON.stringify(xn.body)}`);

  sq(`DELETE FROM orders WHERE user_id=${uid}; DELETE FROM user_roles WHERE user_id=${uid}; DELETE FROM carts WHERE user_id=${uid}; DELETE FROM users WHERE user_id=${uid};`);
  console.log(`\n  ↺ đã dọn`);
  console.log(truot===0 ? `\n  ✔ ĐẠT — ${dat}/${dat}\n` : `\n  ✖ TRƯỢT — ${truot}/${dat+truot}\n`);
  process.exit(truot===0?0:1);
})();
