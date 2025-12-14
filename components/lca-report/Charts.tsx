"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis
} from 'recharts';

interface ChartDataItem {
  name?: string;
  value: number;
  color: string;
}

export const DonutChart = ({
  data,
  innerRadius = 80,
  outerRadius = 140
}: {
  data: ChartDataItem[];
  innerRadius?: number;
  outerRadius?: number;
}) => {
  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export const GaugeChart = ({ score }: { score: number }) => {
  const data = [{ name: 'score', value: score, fill: '#65a30d' }];

  return (
    <div className="w-full h-[250px] relative">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="80%"
          outerRadius="100%"
          barSize={20}
          data={data}
          startAngle={180}
          endAngle={0}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar
            background
            dataKey="value"
            cornerRadius={30}
            fill="#ccff00"
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center pt-10">
        <span className="text-5xl font-bold font-serif text-[#65a30d]">{score}%</span>
      </div>
    </div>
  );
};

export const SimplePieChart = ({ data }: { data: ChartDataItem[] }) => {
  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={140}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
