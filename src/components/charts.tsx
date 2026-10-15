"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  productColors,
  productLabels,
  products,
  type Sample,
} from "@/lib/data";

export default function FeChart({
  samples,
  comparison = false,
}: {
  samples: Sample[];
  comparison?: boolean;
}) {
  if (!samples.length)
    return (
      <div className="chart-empty">
        {comparison
          ? "在样品表中勾选样品，开始比较"
          : "没有匹配样品，请调整筛选条件"}
      </div>
    );
  if (samples.every((sample) => products.every((key) => sample[key] === null)))
    return (
      <div className="chart-empty">所选样品的 FE 均未测，请导入实测值</div>
    );
  const data = samples.slice(0, comparison ? 6 : 12);
  return (
    <div
      className="chart-wrap"
      role="img"
      aria-label={`${comparison ? "样品比较" : "产物 FE"}柱状图，完整数值见下方样品数据表`}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        initialDimension={{ width: 600, height: 280 }}
      >
        <BarChart
          data={data}
          margin={{ top: 14, right: 10, left: -14, bottom: 0 }}
          barGap={5}
          barCategoryGap="24%"
          accessibilityLayer
        >
          <CartesianGrid
            strokeDasharray="3 5"
            vertical={false}
            stroke="#e8eeec"
          />
          <XAxis
            dataKey="sampleId"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#6d7b78" }}
            interval={0}
            tickFormatter={(label: string) =>
              label.length > 18 ? `${label.slice(0, 17)}…` : label
            }
            height={42}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#8b9794" }}
            unit="%"
          />
          <Tooltip
            filterNull
            cursor={{ fill: "#f2f7f5" }}
            contentStyle={{
              border: "1px solid #e1e9e5",
              borderRadius: 12,
              fontSize: 12,
            }}
          formatter={(value) => `${value}%`}
          />
          <Legend
            iconType="circle"
            iconSize={7}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
          {products.map((key) => (
            <Bar
              key={key}
              dataKey={key}
              name={productLabels[key]}
              fill={productColors[key]}
              radius={[4, 4, 0, 0]}
              maxBarSize={comparison ? 32 : 42}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
