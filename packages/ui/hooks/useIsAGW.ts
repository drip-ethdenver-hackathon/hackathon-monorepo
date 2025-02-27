import { useEffect, useState } from "react";
import { getBytecode } from "@wagmi/core";
import { config } from "../providers";
import { abstract } from "viem/chains";

const checkIsContract = async (address: string): Promise<boolean> => {
  const code = await getBytecode(config, {
    address,
    chainId: abstract.id,
  });
  return code !== "0x" && code !== undefined;
};

const useIsAGW = (address: string | undefined) => {
  const [isAGW, setIsAGW] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const isContract = await checkIsContract(address);
        setIsAGW(isContract);
      } catch (e) {
        console.log(e);
      }
    }
    if (address) {
      check();
    }
  }, [address]);

  return isAGW;
};

export default useIsAGW;
