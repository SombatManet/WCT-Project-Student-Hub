import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, FileText, Brain, Users, TrendingUp, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/services/api";

interface Stat {
  icon: any;
  label: string;
  value: string | number;
  color: string;
}

interface Activity {
  title: string;
  description: string;
  time: string;
  type: "quiz" | "assignment" | "class" | "message";
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stat[]>([]);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user]);

const fetchDashboardData = async () => {
  // Fetch profile via backend
  const profileResp = await api.get('/auth/profile');
  const profile = profileResp.data?.data;
  if (!profile) return;

  // Fetch recent activity via backend aggregator
  const activityResp = await api.get('/activity/recent');
  const activities = activityResp.data?.data || [];

  // Fetch dynamic stats
  const statsResp = await api.get('/activity/stats');
  const s = statsResp.data?.data || {};

  if (profile.role === "student") {
    setStats([
      { icon: BookOpen, label: "Enrolled Classes", value: s.enrolled_classes ?? 0, color: "text-primary" },
      { icon: FileText, label: "Pending Assignments", value: s.pending_assignments ?? 0, color: "text-accent" },
      { icon: Brain, label: "Quizzes Available", value: s.quizzes_available ?? 0, color: "text-secondary" },
      { icon: TrendingUp, label: "Average Score", value: `${s.average_score ?? 0}%`, color: "text-success" },
    ]);
  } else if (profile.role === "teacher") {
    setStats([
      { icon: BookOpen, label: "My Classes", value: s.my_classes ?? 0, color: "text-primary" },
      { icon: Users, label: "Total Students", value: s.total_students ?? 0, color: "text-secondary" },
      { icon: FileText, label: "Active Assignments", value: s.active_assignments ?? 0, color: "text-accent" },
      { icon: Brain, label: "Active Quizzes", value: s.active_quizzes ?? 0, color: "text-warning" },
    ]);
  }

  setRecentActivities(activities || []);
};


  return (
    <Layout>
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="rounded-2xl bg-gradient-hero p-8 text-white shadow-lg">
          <h1 className="mb-2 text-3xl font-bold">Welcome back, {user?.username}!</h1>
          <p className="text-white/90">
            {user?.role === "student"
              ? "Ready to continue your learning journey?"
              : "Manage your classes and track student progress"}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, idx) => (
            <Card key={idx} className="transition-all hover:shadow-lg">
              <CardHeader className="flex items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions & Recent Activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Get started with common tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {user?.role === "student" ? (
                <>
                  <Link to="/classes"><Button variant="outline" className="w-full justify-start gap-2"><BookOpen className="h-4 w-4"/> View My Classes</Button></Link>
                  <Link to="/assignments"><Button variant="outline" className="w-full justify-start gap-2"><FileText className="h-4 w-4"/> Check Assignments</Button></Link>
                  <Link to="/quizzes"><Button variant="outline" className="w-full justify-start gap-2"><Brain className="h-4 w-4"/> Take a Quiz</Button></Link>
                </>
              ) : (
                <>
                  <Link to="/classes"><Button variant="outline" className="w-full justify-start gap-2"><BookOpen className="h-4 w-4"/> Manage Classes</Button></Link>
                  <Link to="/assignments"><Button variant="outline" className="w-full justify-start gap-2"><FileText className="h-4 w-4"/> Create Assignment</Button></Link>
                  <Link to="/quizzes"><Button variant="outline" className="w-full justify-start gap-2"><Brain className="h-4 w-4"/> Create Quiz</Button></Link>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest updates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentActivities.length > 0 ? recentActivities.map((activity, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    {activity.type === "quiz" && <Brain className="h-5 w-5 text-primary" />}
                    {activity.type === "assignment" && <FileText className="h-5 w-5 text-accent" />}
                    {activity.type === "class" && <BookOpen className="h-5 w-5 text-secondary" />}
                    {activity.type === "message" && <Users className="h-5 w-5 text-primary" />}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">{activity.title}</p>
                    <p className="text-xs text-muted-foreground">{activity.description}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> {activity.time}
                  </div>
                </div>
              )) : <p className="text-sm text-muted-foreground">No recent activity</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
