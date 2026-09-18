"use client";

import { useState } from "react";
import { SubSidebar, SubItem, ContentPane } from "@/components/SubSidebar";
import SpriteSheetSlicer from "@/components/assets/SpriteSheetSlicer";
import TexturePacker from "@/components/assets/TexturePacker";
import SpritesheetViewer from "@/components/assets/SpritesheetViewer";

const ASSET_TOOLS = [
  { key: "slicer", name: "SpriteSheet Slicer", desc: "Cut an atlas into frames", icon: "✂" },
  { key: "packer", name: "Texture Packer", desc: "Pack images into an atlas", icon: "▩" },
  { key: "viewer", name: "SpriteSheet Viewer", desc: "Preview a frame sequence", icon: "▶" },
];

export default function AssetsPage() {
  const [activeKey, setActiveKey] = useState(ASSET_TOOLS[0].key);
  const active = ASSET_TOOLS.find((t) => t.key === activeKey) || ASSET_TOOLS[0];

  return (
    <>
      <SubSidebar title="Assets Tools">
        {ASSET_TOOLS.map((tool) => (
          <SubItem
            key={tool.key}
            active={tool.key === active.key}
            onClick={() => setActiveKey(tool.key)}
            label={tool.name}
            sub={tool.desc}
            icon={
              <span className="w-[22px] h-[22px] rounded-[6px] flex items-center justify-center text-[11px] flex-shrink-0 mt-0.5 bg-accent2/20 text-accent2">
                {tool.icon}
              </span>
            }
          />
        ))}
      </SubSidebar>

      <ContentPane>
        <div className="bg-panel border border-border rounded-card px-4.5 pt-4.5 pb-4.5">
          <div className="mb-3">
            <div className="text-[15px] font-semibold">{active.name}</div>
            <div className="text-[12.5px] text-muted mt-0.5">{active.desc}</div>
          </div>

          {activeKey === "slicer" && <SpriteSheetSlicer />}
          {activeKey === "packer" && <TexturePacker />}
          {activeKey === "viewer" && <SpritesheetViewer />}
        </div>
      </ContentPane>
    </>
  );
}
