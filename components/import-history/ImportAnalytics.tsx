'use client';

import { useQuery } from '@tanstack/react-query';
import { caosBulkApi } from '@/lib/api/caos-bulk';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

interface ImportAnalyticsProps {
  className?: string;
}

export function ImportAnalytics({ className }: ImportAnalyticsProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['import-analytics'],
    queryFn: () => caosBulkApi.getImportAnalytics(),
  });

  if (isLoading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading analytics...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        Failed to load analytics. Please try again.
      </div>
    );
  }

  const analytics = data?.data;
  if (!analytics) {
    return null;
  }

  // Prepare data for charts
  const uploadsByUserData = analytics.uploadsByUser.map((u) => ({
    name: u.userName || 'Unknown',
    value: u.totalLeads,
    uploads: u.totalUploads,
    successRate: u.successRate,
  }));

  const uniqueVsDuplicateData = [
    { name: 'Unique Leads', value: analytics.uniqueVsDuplicate.uniqueLeads },
    { name: 'Duplicates', value: analytics.uniqueVsDuplicate.duplicateLeads },
    { name: 'Updated (Skill Added)', value: analytics.uniqueVsDuplicate.updatedLeads },
  ];

  const statusDistributionData = analytics.statusDistribution.map((s) => ({
    name: s.status.charAt(0).toUpperCase() + s.status.slice(1),
    value: s.count,
  }));

  const roleBreakdownData = analytics.roleBreakdown.map((r) => ({
    role: r.role.charAt(0).toUpperCase() + r.role.slice(1),
    totalUploads: r.totalUploads,
    totalLeads: r.totalLeads,
    successRate: r.successRate,
  }));

  const uploadsOverTimeData = analytics.uploadsOverTime.map((item) => ({
    date: item.date,
    uploads: item.uploads,
    leads: item.leads,
  }));

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Imports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summaryMetrics.totalImports}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Leads Imported</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summaryMetrics.totalLeadsImported}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Unique Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summaryMetrics.totalUniqueLeads}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Duplicates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summaryMetrics.totalDuplicates}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summaryMetrics.avgSuccessRate.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Uploaders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summaryMetrics.totalUploaders}</div>
          </CardContent>
        </Card>
      </div>

      {/* Upload Performance by User */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload Performance by User</CardTitle>
            <CardDescription>Total unique leads uploaded per user</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={uploadsByUserData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {uploadsByUserData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Uploads per User</CardTitle>
            <CardDescription>Number of uploads per user</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={uploadsByUserData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="uploads" fill="#0088FE" name="Total Uploads" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Success Rate by User */}
      <Card>
        <CardHeader>
          <CardTitle>Success Rate per User</CardTitle>
          <CardDescription>Percentage of successful imports per user</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={uploadsByUserData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis domain={[0, 100]} />
              <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
              <Legend />
              <Bar dataKey="successRate" fill="#00C49F" name="Success Rate (%)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Unique vs Duplicate Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Unique vs Duplicate Breakdown</CardTitle>
            <CardDescription>Distribution of unique, duplicate, and updated leads</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={uniqueVsDuplicateData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {uniqueVsDuplicateData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unique vs Duplicate (Stacked)</CardTitle>
            <CardDescription>Breakdown per user</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={uploadsByUserData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" stackId="a" fill="#0088FE" name="Total Leads" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Status Distribution</CardTitle>
          <CardDescription>Distribution of import statuses</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusDistributionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusDistributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Role-Based Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Role-Based Performance</CardTitle>
          <CardDescription>Comparison of leads uploaded and success rate by role</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={roleBreakdownData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="role" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="totalLeads" fill="#0088FE" name="Total Leads" />
              <Bar yAxisId="left" dataKey="totalUploads" fill="#00C49F" name="Total Uploads" />
              <Bar yAxisId="right" dataKey="successRate" fill="#FFBB28" name="Success Rate (%)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Time-Based Analytics */}
      <Card>
        <CardHeader>
          <CardTitle>Uploads Over Time</CardTitle>
          <CardDescription>Daily uploads and leads imported (Last 30 days)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={uploadsOverTimeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Area yAxisId="left" type="monotone" dataKey="uploads" stackId="1" stroke="#0088FE" fill="#0088FE" name="Uploads" />
              <Area yAxisId="right" type="monotone" dataKey="leads" stackId="2" stroke="#00C49F" fill="#00C49F" name="Leads" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Uploaders */}
      <Card>
        <CardHeader>
          <CardTitle>Top 5 Uploaders</CardTitle>
          <CardDescription>Top uploaders by volume and success rate</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.topUploaders.map((uploader, index) => (
              <div key={uploader.userId} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{uploader.userName}</div>
                    <div className="text-sm text-gray-500">Success Rate: {uploader.successRate.toFixed(1)}%</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">{uploader.totalLeads}</div>
                  <div className="text-sm text-gray-500">leads</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quality Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Quality Metrics</CardTitle>
          <CardDescription>Overall import quality indicators</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Average Duplicate Rate</div>
              <div className="text-2xl font-bold">{analytics.qualityMetrics.avgDuplicateRate.toFixed(1)}%</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Average Success Rate</div>
              <div className="text-2xl font-bold">{analytics.qualityMetrics.avgSuccessRate.toFixed(1)}%</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Average Rows per Upload</div>
              <div className="text-2xl font-bold">{analytics.qualityMetrics.avgRowsPerUpload}</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Largest Single Upload</div>
              <div className="text-2xl font-bold">{analytics.qualityMetrics.largestUpload}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
