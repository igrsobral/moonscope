'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Users,
  Search,
  Filter,
  Crown,
  Medal,
  Award,
} from 'lucide-react';
import { useState } from 'react';

interface LeaderboardEntry {
  id: string;
  username: string;
  avatar?: string;
  portfolioValue: number;
  profitLoss: number;
  profitLossPercentage: number;
  holdingsCount: number;
  topCoin: string;
  joinedDate: string;
  rank: number;
  isVerified?: boolean;
}

interface PortfolioLeaderboardProps {
  currentUserRank?: number;
  currentUserStats?: Omit<LeaderboardEntry, 'rank'>;
}

export function PortfolioLeaderboard({
  currentUserRank,
  currentUserStats,
}: PortfolioLeaderboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('profitLoss');
  const [timeframe, setTimeframe] = useState('7d');
  const [activeTab, setActiveTab] = useState('global');

  const mockLeaderboardData: LeaderboardEntry[] = [
    {
      id: '1',
      username: 'MemeKing2024',
      avatar: '/avatars/user1.jpg',
      portfolioValue: 125000,
      profitLoss: 45000,
      profitLossPercentage: 56.25,
      holdingsCount: 12,
      topCoin: 'PEPE',
      joinedDate: '2024-01-15',
      rank: 1,
      isVerified: true,
    },
    {
      id: '2',
      username: 'DogeWhale',
      portfolioValue: 98000,
      profitLoss: 38000,
      profitLossPercentage: 63.33,
      holdingsCount: 8,
      topCoin: 'DOGE',
      joinedDate: '2024-02-01',
      rank: 2,
      isVerified: true,
    },
    {
      id: '3',
      username: 'ShibaArmy',
      portfolioValue: 87500,
      profitLoss: 32000,
      profitLossPercentage: 57.78,
      holdingsCount: 15,
      topCoin: 'SHIB',
      joinedDate: '2024-01-20',
      rank: 3,
    },
    {
      id: '4',
      username: 'FlokiMaster',
      portfolioValue: 76000,
      profitLoss: 28000,
      profitLossPercentage: 58.33,
      holdingsCount: 10,
      topCoin: 'FLOKI',
      joinedDate: '2024-02-10',
      rank: 4,
    },
    {
      id: '5',
      username: 'BabyDogeHODL',
      portfolioValue: 65000,
      profitLoss: 22000,
      profitLossPercentage: 51.16,
      holdingsCount: 18,
      topCoin: 'BABYDOGE',
      joinedDate: '2024-01-25',
      rank: 5,
    },
    {
      id: '6',
      username: 'SafeMoonDiamond',
      portfolioValue: 58000,
      profitLoss: 18000,
      profitLossPercentage: 45.0,
      holdingsCount: 7,
      topCoin: 'SAFEMOON',
      joinedDate: '2024-02-05',
      rank: 6,
    },
    {
      id: '7',
      username: 'ElonMuskFan',
      portfolioValue: 52000,
      profitLoss: 15000,
      profitLossPercentage: 40.54,
      holdingsCount: 9,
      topCoin: 'ELON',
      joinedDate: '2024-01-30',
      rank: 7,
    },
    {
      id: '8',
      username: 'AkitaInuLover',
      portfolioValue: 47000,
      profitLoss: 12000,
      profitLossPercentage: 34.29,
      holdingsCount: 11,
      topCoin: 'AKITA',
      joinedDate: '2024-02-12',
      rank: 8,
    },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  const filteredData = mockLeaderboardData.filter(
    entry =>
      entry.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.topCoin.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Portfolio Leaderboard</h2>
          <p className="text-muted-foreground">
            Compare your performance with top meme coin traders
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {mockLeaderboardData.length} traders
          </span>
        </div>
      </div>

      {currentUserStats && currentUserRank && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Your Ranking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {getRankIcon(currentUserRank)}
                  <span className="text-lg font-semibold">Rank #{currentUserRank}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Portfolio Value: {formatCurrency(currentUserStats.portfolioValue)}
                </div>
                <div
                  className={`text-sm font-medium ${
                    currentUserStats.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {formatCurrency(Math.abs(currentUserStats.profitLoss))} (
                  {formatPercentage(currentUserStats.profitLossPercentage)})
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search traders or coins..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24 Hours</SelectItem>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="profitLoss">Profit/Loss</SelectItem>
              <SelectItem value="profitLossPercentage">% Gains</SelectItem>
              <SelectItem value="portfolioValue">Portfolio Value</SelectItem>
              <SelectItem value="holdingsCount">Holdings Count</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="global">Global</TabsTrigger>
          <TabsTrigger value="friends">Friends</TabsTrigger>
          <TabsTrigger value="verified">Verified</TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="space-y-4">
          <div className="space-y-2">
            {filteredData.map((entry, index) => (
              <Card
                key={entry.id}
                className={`transition-colors hover:bg-muted/50 ${
                  index < 3 ? 'border-primary/20' : ''
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3">
                        {getRankIcon(entry.rank)}
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
                          {entry.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{entry.username}</span>
                            {entry.isVerified && (
                              <Badge variant="secondary" className="text-xs">
                                Verified
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {entry.holdingsCount} holdings • Top: {entry.topCoin}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(entry.portfolioValue)}</div>
                      <div
                        className={`flex items-center gap-1 text-sm ${
                          entry.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {entry.profitLoss >= 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {formatCurrency(Math.abs(entry.profitLoss))} (
                        {formatPercentage(entry.profitLossPercentage)})
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="friends" className="space-y-4">
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No Friends Yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Connect with other traders to see their performance here.
              </p>
              <Button className="mt-4" variant="outline">
                Find Friends
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="verified" className="space-y-4">
          <div className="space-y-2">
            {filteredData
              .filter(entry => entry.isVerified)
              .map(entry => (
                <Card
                  key={entry.id}
                  className="border-primary/20 transition-colors hover:bg-muted/50"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                          {getRankIcon(entry.rank)}
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
                            {entry.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{entry.username}</span>
                              <Badge variant="default" className="text-xs">
                                Verified
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {entry.holdingsCount} holdings • Top: {entry.topCoin}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(entry.portfolioValue)}</div>
                        <div
                          className={`flex items-center gap-1 text-sm ${
                            entry.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {entry.profitLoss >= 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {formatCurrency(Math.abs(entry.profitLoss))} (
                          {formatPercentage(entry.profitLossPercentage)})
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
