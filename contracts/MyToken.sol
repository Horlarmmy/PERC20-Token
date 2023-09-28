// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./PERC20.sol";
//import "https://github.com/SigmaGmbH/swisstronik-tutorials/blob/main/PERC20_interaction/contracts/PERC20.sol";

/**
 * @dev Sample implementation of the {PERC20} contract.
 */
contract MyPrivateToken is PERC20 {
    constructor() PERC20("Investor", "INV") {}

    /// @dev Wraps SWTR to PSWTR.
    receive() external payable {
        _mint(_msgSender(), msg.value * 1000);
    }

    /**
     * @dev Regular `balanceOf` function marked as internal, so we override it to extend visibility  
     */ 
    function balanceOf(address account) public view override returns (uint256) {
        // This function should be called by EOA using signed `eth_call` to make EVM able to
        // extract original sender of this request. In case of regular (non-signed) `eth_call`
        // msg.sender will be empty address (0x0000000000000000000000000000000000000000).
        require(msg.sender == account, "PERC20Sample: msg.sender != account");

        // If msg.sender is correct we return the balance
        return _balances[account];
    }

    /**
     * @dev Regular `allowance` function marked as internal, so we override it to extend visibility  
     */
    function allowance(address owner, address spender) public view virtual override returns (uint256) {
        // This function should be called by EOA using signed `eth_call` to make EVM able to
        // extract original sender of this request. In case of regular (non-signed) `eth_call`
        // msg.sender will be empty address (0x0000000000000000000000000000000000000000)
        require(msg.sender == spender, "PERC20Sample: msg.sender != account");
        
        // If msg.sender is correct we return the allowance
        return _allowances[owner][spender];
    }
}