import { Bytes } from '@graphprotocol/graph-ts';

/**
 * bytes32（短字符串 UTF-8 编码，Solidity `bytes32`）→ 可读字符串。
 *
 * 用途：链上 RiskRegistry 的 tags 是 bytes32[]（data-sync 用
 * ethers.encodeBytes32String 编码，如 "OFAC_SDN_ADVANCED"）。若 mapping 直接
 * `toHexString()`，subgraph 会存成 0x4f4641435f... 十六进制串，前端 `tags.join()`
 * 显示为乱码。必须解码回 ASCII。
 *
 * 约定与 ethers.encodeBytes32String 对齐：从首字节起逐字节取 ASCII，遇 0x00 终止
 * （短字符串编码以 0 填充尾部）。
 *
 * 此前 complianceEngine.ts 内有一份同名局部实现，此处提取为共享工具，
 * 供 riskRegistry（tags）与 complianceEngine（checkType/reason）共用。
 */
export function bytes32ToString(bytes: Bytes): string {
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    let byte = bytes[i];
    if (byte == 0) break;
    result += String.fromCharCode(byte);
  }
  return result;
}
