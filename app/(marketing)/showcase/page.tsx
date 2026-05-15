import type { Metadata } from "next";
import { Showcase } from "./showcase";

export const metadata: Metadata = {
  title: "Showcase",
  description:
    "A live walkthrough of Sunvasi — the contract, the client funding, the AI arbitrator, the on-chain settlement.",
};

export default function ShowcasePage() {
  return <Showcase />;
}
