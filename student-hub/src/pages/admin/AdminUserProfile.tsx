import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  BookOpen, 
  FileText, 
  Brain, 
  MessageSquare, 
  Trophy, 
  CheckCircle,
  Lock,
  AlertCircle,
  Copy as CopyIcon,
  Check as CheckIcon
} from "lucide-react";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

interface ProfileData {
  id: string;
  username: string;
  email: string;
  role: string;
  created_at?: string;
  avatar_url?: string | null;
}

interface UserStats {
  profile: ProfileData;
  classCount: number;
  assignmentCount: number;
  quizCount: number;
  messagesSent: number;
  messagesReceived: number;
  totalPoints: number;
  submittedAssignments: number;
  completedQuizzes: number;
}

interface UserMessageItem {
  id: string;
  title: string;
  content: string;
  created_at: string;
  sender_id: string;
  recipient_id: string;
}

export default function AdminUserProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [messages, setMessages] = useState<UserMessageItem[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        // Fetch profile
        const profileResponse = await api.get(`/auth/profile/${id}`);
        setProfile(profileResponse.data.data || profileResponse.data);

        // Fetch stats
        const statsResponse = await api.get(`/admin/users/${id}/stats`);
        setStats(statsResponse.data.data);

        // Fetch recent messages
        const msgsResp = await api.get(`/admin/users/${id}/messages`, { params: { limit: 10 } });
        setMessages(msgsResp.data?.data?.messages || []);
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.response?.data?.message || "Failed to load profile",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    setResettingPassword(true);
    try {
      await api.patch(`/admin/users/${id}/reset-password`, {
        newPassword: newPassword,
      });

      toast({
        title: "Success",
        description: "Password reset successfully",
      });

      setShowPasswordDialog(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to reset password",
        variant: "destructive",
      });
    } finally {
      setResettingPassword(false);
    }
  };

  const initials = (name?: string) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    const first = parts[0]?.[0] || "";
    const second = parts.length > 1 ? parts[1]?.[0] || "" : "";
    return (first + second).toUpperCase() || name[0]?.toUpperCase() || "?";
  };

  return (
    <AdminLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground">User Profile</h1>
            <p className="text-muted-foreground mt-2">Complete user information and management</p>
          </div>
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
        </div>

        {loading ? (
          <div className="py-8 text-center">Loading...</div>
        ) : !profile ? (
          <div className="py-8 text-center text-muted-foreground">No profile found.</div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-6">
                  <div>
                    <Avatar className="h-24 w-24">
                      {profile.avatar_url ? (
                        <AvatarImage src={(profile.avatar_url.startsWith('http') ? profile.avatar_url : (api.defaults.baseURL?.replace(/\/api\/?$/, '') || '') + profile.avatar_url)} alt={profile.username} />
                      ) : (
                        <AvatarFallback className="text-xl">{initials(profile.username)}</AvatarFallback>
                      )}
                    </Avatar>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-semibold">{profile.username}</span>
                      <Badge variant="secondary">{profile.role}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{profile.email}</div>
                    <Separator className="my-2" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-muted-foreground">Account ID</div>
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-sm break-all">{profile.id}</div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(profile.id);
                                setCopied(true);
                                toast({ title: 'Copied', description: 'User ID copied to clipboard.' });
                                setTimeout(() => setCopied(false), 1500);
                              } catch (e) {
                                toast({ title: 'Copy failed', description: 'Unable to copy ID', variant: 'destructive' });
                              }
                            }}
                            aria-label="Copy user ID"
                          >
                            {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Created At</div>
                        <div>{profile.created_at ? new Date(profile.created_at).toLocaleString() : "—"}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* User Stats */}
            {stats && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Classes</CardTitle>
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.classCount}</div>
                    <p className="text-xs text-muted-foreground">
                      {profile.role === 'teacher' ? 'Teaching' : 'Enrolled in'}
                    </p>
                  </CardContent>
                </Card>

                {profile.role === 'student' && (
                  <>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Assignments</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{stats.submittedAssignments}</div>
                        <p className="text-xs text-muted-foreground">Submitted</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Quizzes</CardTitle>
                        <Brain className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{stats.completedQuizzes}</div>
                        <p className="text-xs text-muted-foreground">Completed</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Points</CardTitle>
                        <Trophy className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{stats.totalPoints}</div>
                        <p className="text-xs text-muted-foreground">Earned</p>
                      </CardContent>
                    </Card>
                  </>
                )}

                {profile.role === 'teacher' && (
                  <>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Assignments</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{stats.assignmentCount}</div>
                        <p className="text-xs text-muted-foreground">Created</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Quizzes</CardTitle>
                        <Brain className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{stats.quizCount}</div>
                        <p className="text-xs text-muted-foreground">Created</p>
                      </CardContent>
                    </Card>
                  </>
                )}

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Messages</CardTitle>
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.messagesSent + stats.messagesReceived}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats.messagesSent} sent, {stats.messagesReceived} received
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Account Security */}
            <Card>
              <CardHeader>
                <CardTitle>Account Security</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Reset User Password</p>
                      <p className="text-sm text-muted-foreground">
                        Set a new password for this user. They will be able to log in with the new password immediately.
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => setShowPasswordDialog(true)}>
                    <Lock className="mr-2 h-4 w-4" />
                    Reset Password
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Recent Messages */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Messages</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {messages.length ? (
                  messages.map((m) => (
                    <div key={m.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm">{m.title}</div>
                        <div className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</div>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">{m.content || '—'}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">No messages</div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Reset Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset User Password</DialogTitle>
            <DialogDescription>
              Set a new password for {profile?.username}. The user will be able to log in with this password immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
              />
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleResetPassword}
                disabled={resettingPassword}
                className="flex-1"
              >
                <Lock className="mr-2 h-4 w-4" />
                {resettingPassword ? "Resetting..." : "Reset Password"}
              </Button>
              <Button
                onClick={() => {
                  setShowPasswordDialog(false);
                  setNewPassword("");
                  setConfirmPassword("");
                }}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
