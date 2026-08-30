import { H5_CUSTOMER_ENABLED } from "../config";

export function blockDisabledH5Customer(): boolean {
  // #ifdef H5
  if (!H5_CUSTOMER_ENABLED) {
    uni.reLaunch({ url: "/pages_admin/login/index" });
    return true;
  }
  // #endif
  return false;
}
