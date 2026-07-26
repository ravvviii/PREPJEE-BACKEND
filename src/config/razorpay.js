import Razorpay from 'razorpay';
import { env } from './env.js';

export const razorpayClient = new Razorpay({
  key_id: env.razorpay.keyId,
  key_secret: env.razorpay.keySecret,
});
