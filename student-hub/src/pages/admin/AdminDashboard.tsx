import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, BookOpen, ClipboardList, FileText } from "lucide-react";
import { api } from "@/services/api";
import { Link } from "react-router-dom";

interface Stats {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  totalAssignments: number;
  totalQuizzes: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalStudents: 0,
    totalTeachers: 0,
    totalClasses: 0,
    totalAssignments: 0,
    totalQuizzes: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/stats');
      const data = response.data.data || response.data;
      if (data) {
        setStats({
          totalStudents: data.totalStudents || 0,
          totalTeachers: data.totalTeachers || 0,
          totalClasses: data.totalClasses || 0,
          totalAssignments: data.totalAssignments || 0,
          totalQuizzes: data.totalQuizzes || 0,
        });
      }
    } catch (err) {
      console.error('Failed to fetch admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { title: "Total Students", value: stats.totalStudents, icon: Users, gradient: "from-blue-500 to-blue-600" },
    { title: "Total Teachers", value: stats.totalTeachers, icon: GraduationCap, gradient: "from-green-500 to-green-600" },
    { title: "Total Classes", value: stats.totalClasses, icon: BookOpen, gradient: "from-purple-500 to-purple-600" },
    { title: "Total Assignments", value: stats.totalAssignments, icon: ClipboardList, gradient: "from-orange-500 to-orange-600" },
    { title: "Total Quizzes", value: stats.totalQuizzes, icon: FileText, gradient: "from-pink-500 to-pink-600" },
  ];

  return (
    <AdminLayout>
      <div className="container mx-auto p-6 space-y-8">
        <h1 className="text-4xl font-bold text-foreground">Admin Dashboard</h1>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {loading
            ? [...Array(5)].map((_, i) => (
                <Card key={i} className="animate-pulse"><CardHeader className="h-20 bg-muted" /><CardContent className="h-24 bg-muted/50" /></Card>
              ))
            : statCards.map((stat) => {
                const Icon = stat.icon;
                return (
                  <Card key={stat.title} className="overflow-hidden border-border hover:shadow-lg transition-shadow">
                    <CardHeader className={`bg-gradient-to-br ${stat.gradient} text-white pb-4`}><Icon className="h-8 w-8" /></CardHeader>
                    <CardContent className="pt-6">
                      <CardTitle className="text-3xl font-bold text-foreground">{stat.value}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">{stat.title}</p>
                    </CardContent>
                  </Card>
                );
              })}
        </div>

        {/* Quick Actions */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Link to="/admin/users" className="block p-4 rounded-lg bg-muted hover:bg-muted/80">Manage Users</Link>
              <Link to="/admin/classes" className="block p-4 rounded-lg bg-muted hover:bg-muted/80">Manage Classes</Link>
              <Link to="/admin/assignments" className="block p-4 rounded-lg bg-muted hover:bg-muted/80">Manage Assignments</Link>
              <Link to="/admin/quizzes" className="block p-4 rounded-lg bg-muted hover:bg-muted/80">Quiz Analytics</Link>
              <Link to="/admin/contact" className="block p-4 rounded-lg bg-muted hover:bg-muted/80">Contact Messages</Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
