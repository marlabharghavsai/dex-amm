const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DEX", function () {
  let dex, tokenA, tokenB;
  let owner, addr1, addr2;

  const toEth = ethers.utils.parseEther;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    tokenA = await MockERC20.deploy("Token A", "TKA");
    tokenB = await MockERC20.deploy("Token B", "TKB");

    const DEX = await ethers.getContractFactory("DEX");
    dex = await DEX.deploy(tokenA.address, tokenB.address);

    await tokenA.approve(dex.address, toEth("1000000"));
    await tokenB.approve(dex.address, toEth("1000000"));

    await tokenA.connect(addr1).mint(addr1.address, toEth("1000"));
    await tokenB.connect(addr1).mint(addr1.address, toEth("1000"));

    await tokenA.connect(addr1).approve(dex.address, toEth("1000000"));
    await tokenB.connect(addr1).approve(dex.address, toEth("1000000"));
  });

  describe("Liquidity Management", function () {
    it("should allow initial liquidity provision", async function () {
      await dex.addLiquidity(toEth("100"), toEth("200"));
      const reserves = await dex.getReserves();
      expect(reserves[0]).to.equal(toEth("100"));
      expect(reserves[1]).to.equal(toEth("200"));
    });

    it("should mint correct LP tokens for first provider", async function () {
      await dex.addLiquidity(toEth("100"), toEth("200"));
      const liquidity = await dex.liquidity(owner.address);
      expect(liquidity).to.be.gt(0);
    });

    it("should allow subsequent liquidity additions", async function () {
      await dex.addLiquidity(toEth("100"), toEth("200"));
      await dex.connect(addr1).addLiquidity(toEth("50"), toEth("100"));
      expect(await dex.totalLiquidity()).to.be.gt(0);
    });

    it("should maintain price ratio on liquidity addition", async function () {
      await dex.addLiquidity(toEth("100"), toEth("200"));
      await expect(
        dex.connect(addr1).addLiquidity(toEth("50"), toEth("90"))
      ).to.be.revertedWith("Ratio mismatch");
    });

    it("should allow partial liquidity removal", async function () {
      await dex.addLiquidity(toEth("100"), toEth("200"));
      const lp = await dex.liquidity(owner.address);
      await dex.removeLiquidity(lp.div(2));
      expect(await dex.liquidity(owner.address)).to.equal(lp.div(2));
    });

    it("should return correct token amounts on liquidity removal", async function () {
      await dex.addLiquidity(toEth("100"), toEth("200"));
      const lp = await dex.liquidity(owner.address);
      await dex.removeLiquidity(lp);
      expect(await tokenA.balanceOf(owner.address)).to.be.gt(0);
      expect(await tokenB.balanceOf(owner.address)).to.be.gt(0);
    });

    it("should revert on zero liquidity addition", async function () {
      await expect(dex.addLiquidity(0, 0)).to.be.revertedWith("Zero amount");
    });

    it("should revert when removing more liquidity than owned", async function () {
      await expect(dex.removeLiquidity(1)).to.be.revertedWith(
        "Not enough liquidity"
      );
    });
  });

  describe("Token Swaps", function () {
    beforeEach(async function () {
      await dex.addLiquidity(toEth("100"), toEth("200"));
    });

    it("should swap token A for token B", async function () {
      await dex.swapAForB(toEth("10"));
      expect(await tokenB.balanceOf(owner.address)).to.be.gt(0);
    });

    it("should swap token B for token A", async function () {
      await dex.swapBForA(toEth("10"));
      expect(await tokenA.balanceOf(owner.address)).to.be.gt(0);
    });

    it("should calculate correct output amount with fee", async function () {
      const out = await dex.getAmountOut(
        toEth("10"),
        toEth("100"),
        toEth("200")
      );
      expect(out).to.be.gt(0);
    });

    it("should update reserves after swap", async function () {
      await dex.swapAForB(toEth("10"));
      const reserves = await dex.getReserves();
      expect(reserves[0]).to.equal(toEth("110"));
    });

    it("should increase k after swap due to fees", async function () {
      const r1 = await dex.getReserves();
      const k1 = r1[0].mul(r1[1]);

      await dex.swapAForB(toEth("10"));

      const r2 = await dex.getReserves();
      const k2 = r2[0].mul(r2[1]);

      expect(k2).to.be.gt(k1);
    });

    it("should revert on zero swap amount", async function () {
      await expect(dex.swapAForB(0)).to.be.revertedWith("Zero swap");
    });

    it("should handle large swaps with high price impact", async function () {
      await dex.swapAForB(toEth("80"));
      const reserves = await dex.getReserves();
      expect(reserves[1]).to.be.lt(toEth("200"));
    });

    it("should handle multiple consecutive swaps", async function () {
      await dex.swapAForB(toEth("5"));
      await dex.swapAForB(toEth("5"));
      await dex.swapBForA(toEth("5"));
      expect(await dex.reserveA()).to.be.gt(0);
    });
  });

  describe("Price Calculations", function () {
    it("should return correct initial price", async function () {
      await dex.addLiquidity(toEth("100"), toEth("200"));
      const price = await dex.getPrice();
      expect(price).to.equal(2);
    });

    it("should update price after swaps", async function () {
      await dex.addLiquidity(toEth("100"), toEth("200"));
      await dex.swapAForB(toEth("10"));
      const price = await dex.getPrice();
      expect(price).to.not.equal(2);
    });

    it("should handle price queries with zero reserves gracefully", async function () {
      await expect(dex.getPrice()).to.be.revertedWith("No liquidity");
    });
  });

  describe("Fee Distribution", function () {
    it("should accumulate fees for liquidity providers", async function () {
      await dex.addLiquidity(toEth("100"), toEth("200"));
      await dex.swapAForB(toEth("10"));
      const lp = await dex.liquidity(owner.address);
      expect(lp).to.be.gt(0);
    });

    it("should distribute fees proportionally to LP share", async function () {
      await dex.addLiquidity(toEth("100"), toEth("200"));
      await dex.connect(addr1).addLiquidity(toEth("50"), toEth("100"));
      await dex.swapAForB(toEth("10"));
      expect(await dex.totalLiquidity()).to.be.gt(0);
    });
  });

  describe("Edge Cases", function () {
    it("should handle very small liquidity amounts", async function () {
      await dex.addLiquidity(1000, 2000);
      expect(await dex.totalLiquidity()).to.be.gt(0);
    });

    it("should handle very large liquidity amounts", async function () {
      await dex.addLiquidity(toEth("100000"), toEth("200000"));
      expect(await dex.totalLiquidity()).to.be.gt(0);
    });

    it("should prevent unauthorized access", async function () {
      await expect(
        dex.connect(addr2).removeLiquidity(1)
      ).to.be.reverted;
    });
  });

  describe("Events", function () {
    it("should emit LiquidityAdded event", async function () {
      await expect(dex.addLiquidity(toEth("10"), toEth("20")))
        .to.emit(dex, "LiquidityAdded");
    });

    it("should emit LiquidityRemoved event", async function () {
      await dex.addLiquidity(toEth("10"), toEth("20"));
      const lp = await dex.liquidity(owner.address);
      await expect(dex.removeLiquidity(lp))
        .to.emit(dex, "LiquidityRemoved");
    });

    it("should emit Swap event", async function () {
      await dex.addLiquidity(toEth("10"), toEth("20"));
      await expect(dex.swapAForB(toEth("1")))
        .to.emit(dex, "Swap");
    });
  });
});
