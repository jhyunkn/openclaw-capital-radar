export type DirectionalBias = 'bullish' | 'constructive' | 'neutral' | 'cautious' | 'bearish';

export type RadarAction =
  | 'add'
  | 'hold'
  | 'trim'
  | 'avoid'
  | 'watch'
  | 'defend'
  | 'research-only';

export interface SupportResistanceZone {
  label: string;
  low: number;
  high: number;
  type: 'support' | 'resistance' | 'pivot' | 'invalidation';
  relevance: 'primary' | 'secondary' | 'watch';
  reasoning?: string;
}

export interface Catalyst {
  date?: string;
  title: string;
  type: 'earnings' | 'product' | 'macro' | 'regulatory' | 'contract' | 'technical' | 'other';
  expectedImpact: 'positive' | 'negative' | 'mixed' | 'unknown';
  notes?: string;
}

export interface RiskScenario {
  name: string;
  probability?: number;
  downsideLevel?: number;
  trigger: string;
  response: RadarAction;
}

export interface MarketRegime {
  id: string;
  label: string;
  phase?: string;
  liquidityCondition: 'supportive' | 'neutral' | 'tightening' | 'stress';
  technicalRegime: 'uptrend' | 'range' | 'breakdown' | 'recovery' | 'transition';
  volatilityState: 'contained' | 'rising' | 'stress';
  recommendedRiskPosture: RadarAction;
}

export interface TickerSignal {
  ticker: string;
  price: number;
  asOf?: string;
  directionalBias: DirectionalBias;
  probabilityUp: number;
  probabilityBase: number;
  probabilityDown: number;
  supportZones: SupportResistanceZone[];
  resistanceZones: SupportResistanceZone[];
  valuationRisk: 'low' | 'moderate' | 'high' | 'extreme';
  technicalRegime: MarketRegime['technicalRegime'];
  liquidityCondition?: MarketRegime['liquidityCondition'];
  catalysts?: Catalyst[];
  riskScenarios?: RiskScenario[];
  thesis: string;
  invalidation: string;
  recommendedAction: RadarAction;
}
