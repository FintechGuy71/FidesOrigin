// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/IPreTransactionGuard.sol";

/**
 * @title MockPreTransactionGuard
 * @notice [R2 测试] "回声"式 Guard：assessTransaction 为 view（接口约束），
 *         无法写存储，改为将收到的 intent 内容编码进返回值供测试断言。
 *         - riskScore 字段回传 intent.value（token==0 时的 ETH 金额）
 *         - reason 字段回传 token 地址 + data 解码出的 amount（hex 字符串）
 *         可通过 setNextAction 控制返回动作（ALLOW/WARN/BLOCK）。
 */
contract MockPreTransactionGuard is IPreTransactionGuard {
    Action public nextAction = Action.ALLOW;

    function setNextAction(Action action) external {
        nextAction = action;
    }

    function assessAddress(address) external view returns (RiskAssessment memory) {
        return RiskAssessment(nextAction, 0, 100, "", block.timestamp);
    }

    function assessTransaction(TransactionIntent calldata intent) external view returns (RiskAssessment memory) {
        uint256 amountInData = 0;
        if (intent.data.length == 32) {
            amountInData = abi.decode(intent.data, (uint256));
        }
        // reason: "<tokenAddress>:<amountInData>"（供测试解析）
        string memory reason = string(abi.encodePacked(
            _addrToHex(intent.token), ":", _uintToStr(amountInData)
        ));
        return RiskAssessment(nextAction, intent.value, 100, reason, block.timestamp);
    }

    function assessBatch(address[] calldata addrs) external view returns (RiskAssessment[] memory) {
        RiskAssessment[] memory out = new RiskAssessment[](addrs.length);
        for (uint256 i = 0; i < addrs.length; i++) {
            out[i] = RiskAssessment(Action.ALLOW, 0, 100, "", block.timestamp);
        }
        return out;
    }

    function currentMerkleRoot() external pure returns (bytes32) {
        return bytes32(0);
    }

    function _uintToStr(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 len;
        uint256 tmp = v;
        while (tmp != 0) { tmp /= 10; len++; }
        bytes memory b = new bytes(len);
        while (v != 0) { b[--len] = bytes1(uint8(48 + (v % 10))); v /= 10; }
        return string(b);
    }

    function _addrToHex(address a) internal pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory s = new bytes(42);
        s[0] = '0'; s[1] = 'x';
        for (uint256 i = 0; i < 20; i++) {
            uint8 b = uint8(uint160(a) >> (8 * (19 - i)));
            s[2 + i * 2] = hexChars[b >> 4];
            s[3 + i * 2] = hexChars[b & 0x0f];
        }
        return string(s);
    }
}
