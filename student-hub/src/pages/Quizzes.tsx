import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";
import { Plus, Brain, Clock, Award, Loader2, Play, CheckCircle2, Trash2, Eye, X, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
  points?: number;
}

interface QuizResult {
  questionIndex: number;
  correct: boolean;
  correctAnswer: number;
  userAnswer: number;
  points: number;
}

interface Submission {
  _id: string;
  student: {
    _id: string;
    username: string;
    email: string;
  } | string;
  answers: number[];
  score: number;
  results: QuizResult[];
  submittedAt: string;
}

interface Quiz {
  id?: string;
  _id?: string;
  title: string;
  description: string;
  class: {
    id?: string;
    _id?: string;
    name: string;
  };
  questions: Question[];
  timeLimit?: number;
  time_limit?: number;
  teacher: {
    id?: string;
    _id?: string;
    username: string;
  } | string;
  submissions?: Submission[];
  createdAt?: string;
  created_at?: string;
}

interface Class {
  _id: string;
  name: string;
}

export default function Quizzes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [takeQuizOpen, setTakeQuizOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [selectedStudentSubmission, setSelectedStudentSubmission] = useState<{quiz: Quiz, submission: Submission} | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [quizResult, setQuizResult] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [studentSubmissions, setStudentSubmissions] = useState<Submission[]>([]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    class: "",
    timeLimit: 30,
    questions: [
      {
        question: "",
        options: ["", "", "", ""],
        correctAnswer: 0,
        points: 1
      },
    ],
  });

  useEffect(() => {
    fetchClasses();
    fetchQuizzes();
  }, []);

  const fetchClasses = async () => {
    try {
      const response = await api.get("/classes");
      setClasses(response.data.data.classes);
    } catch (error: any) {
      console.error("Failed to fetch classes:", error);
      toast({
        title: "Error",
        description: "Failed to load classes",
        variant: "destructive",
      });
    }
  };

  const fetchQuizzes = async () => {
    try {
      console.log("Fetching quizzes...");
      
      // If user is teacher, fetch quizzes they created
      if (user?.role === "teacher") {
        const response = await api.get("/classes");
        const allClasses = response.data.data.classes || [];
        
        if (allClasses.length === 0) {
          setQuizzes([]);
          setLoading(false);
          return;
        }
        
        const quizzesPromises = allClasses.map((classItem: any) =>
          api.get(`/quizzes/class/${classItem.id || classItem._id}`).catch(() => ({ data: { data: { quizzes: [] } } }))
        );
        
        const quizzesResponses = await Promise.all(quizzesPromises);
        const allQuizzes = quizzesResponses.flatMap(
          (response) => response.data?.data?.quizzes || []
        );
        
        // Filter quizzes created by current teacher - handle both populated and non-populated teacher
        const teacherQuizzes = allQuizzes.filter((quiz: Quiz) => {
          const teacherId = typeof quiz.teacher === 'object' ? quiz.teacher._id : quiz.teacher;
          return teacherId === user._id;
        });
        
        console.log("Teacher quizzes:", teacherQuizzes);
        setQuizzes(teacherQuizzes);
      } else {
        // If student, fetch all quizzes from their classes
        const response = await api.get("/classes");
        const allClasses = response.data.data.classes || [];
        console.log("All classes:", allClasses);
        
        if (allClasses.length === 0) {
          setQuizzes([]);
          setLoading(false);
          return;
        }
        
        const quizzesPromises = allClasses.map((classItem: any) =>
          api.get(`/quizzes/class/${classItem.id || classItem._id}`).catch(() => ({ data: { data: { quizzes: [] } } }))
        );
        
        const quizzesResponses = await Promise.all(quizzesPromises);
        console.log("Quizzes responses:", quizzesResponses);
        
        const allQuizzes = quizzesResponses.flatMap(
          (response) => response.data?.data?.quizzes || []
        );
        
        console.log("All quizzes:", allQuizzes);
        setQuizzes(allQuizzes);
      }
    } catch (error: any) {
      console.error("Failed to fetch quizzes:", error);
      console.error("Error details:", error.response?.data);
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to load quizzes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      console.log("Creating quiz with data:", formData);
      
      const quizData = {
        title: formData.title,
        description: formData.description,
        class: formData.class,
        timeLimit: formData.timeLimit,
        questions: formData.questions.map(q => ({
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          points: q.points || 1
        }))
      };

      const response = await api.post("/quizzes", quizData);
      console.log("Quiz created successfully:", response.data);
      
      toast({
        title: "Success",
        description: "Quiz created successfully!",
      });
      
      setDialogOpen(false);
      setFormData({
        title: "",
        description: "",
        class: "",
        timeLimit: 30,
        questions: [{ question: "", options: ["", "", "", ""], correctAnswer: 0, points: 1 }],
      });
      
      await fetchQuizzes();
    } catch (error: any) {
      console.error("Create quiz error:", error);
      console.error("Error details:", error.response?.data);
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to create quiz",
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!selectedQuiz) return;

    setFormLoading(true);
    try {
      console.log("Submitting quiz:", selectedQuiz._id, "Answers:", answers);
      
      const response = await api.post(`/quizzes/${selectedQuiz.id || selectedQuiz._id}/submit`, {
        answers,
      });
      
      console.log("Quiz submitted successfully:", response.data);
      setQuizResult(response.data.data);
      
      toast({
        title: "Quiz Submitted!",
        description: `You scored ${response.data.data.score} out of ${response.data.data.maxPoints} points`,
      });
      
      // Close the quiz dialog and refresh the quiz list
      setTakeQuizOpen(false);
      setSelectedQuiz(null);
      setAnswers([]);
      setCurrentQuestion(0);
      
      await fetchQuizzes();
    } catch (error: any) {
      console.error("Submit quiz error:", error);
      console.error("Error details:", error.response?.data);
      
      const errorMsg = error.response?.data?.message || "Failed to submit quiz";
      
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
      
      // Auto-close dialog if already submitted
      if (errorMsg.toLowerCase().includes("already submitted")) {
        setTakeQuizOpen(false);
        setSelectedQuiz(null);
        await fetchQuizzes();
      }
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (!confirm("Are you sure you want to delete this quiz? This action cannot be undone.")) {
      return;
    }

    setDeleteLoading(quizId);
    try {
      await api.delete(`/quizzes/${quizId}`);
      
      toast({
        title: "Success",
        description: "Quiz deleted successfully!",
      });
      
      setQuizzes(prev => prev.filter(quiz => (quiz.id || quiz._id) !== quizId));
    } catch (error: any) {
      console.error("Delete quiz error:", error);
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete quiz",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleReviewQuiz = async (quiz: Quiz) => {
    try {
      const quizId = quiz.id || quiz._id;
      const response = await api.get(`/quizzes/${quizId}/submission`);
      setSelectedQuiz(response.data.data.quiz);
      setQuizResult({
        score: response.data.data.submission.score,
        maxPoints: response.data.data.quiz.questions.reduce((sum: number, q: Question) => sum + (q.points || 1), 0),
        results: response.data.data.submission.results
      });
      setReviewDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to load quiz review",
        variant: "destructive",
      });
    }
  };

  const handleViewResults = async (quiz: Quiz) => {
    try {
      const quizId = quiz.id || quiz._id;
      const response = await api.get(`/quizzes/${quizId}/results`);
      setSelectedQuiz(response.data.data.quiz);
      setStudentSubmissions(response.data.data.submissions);
      setResultsDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to load quiz results",
        variant: "destructive",
      });
    }
  };

  const handleViewStudentSubmission = async (quiz: Quiz, studentId: string) => {
    try {
      const quizId = quiz.id || quiz._id;
      const response = await api.get(`/quizzes/${quizId}/submissions/${studentId}`);
      setSelectedStudentSubmission({
        quiz: response.data.data.quiz,
        submission: response.data.data.submission
      });
      setReviewDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to load student submission",
        variant: "destructive",
      });
    }
  };

  const addQuestion = () => {
    setFormData(prev => ({
      ...prev,
      questions: [
        ...prev.questions,
        { question: "", options: ["", "", "", ""], correctAnswer: 0, points: 1 },
      ],
    }));
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    setFormData(prev => {
      const newQuestions = [...prev.questions];
      newQuestions[index] = { ...newQuestions[index], [field]: value };
      return { ...prev, questions: newQuestions };
    });
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    setFormData(prev => {
      const newQuestions = [...prev.questions];
      const newOptions = [...newQuestions[qIndex].options];
      newOptions[oIndex] = value;
      newQuestions[qIndex].options = newOptions;
      return { ...prev, questions: newQuestions };
    });
  };

  // Calculate max points for a quiz
  const calculateMaxPoints = (quiz: Quiz) => {
    return quiz.questions.reduce((sum, q) => sum + (q.points || 1), 0);
  };

  // Check if user has already submitted a quiz
  const hasUserSubmitted = (quiz: Quiz) => {
    if (!quiz.submissions || !user) return false;
    const userId = user.id || user._id;
    return quiz.submissions.some((sub: Submission) => {
      const studentId = typeof sub.student === 'object' ? (sub.student.id || sub.student._id) : sub.student;
      return String(studentId) === String(userId);
    });
  };

  // Get user's score for a quiz
  const getUserScore = (quiz: Quiz) => {
    if (!quiz.submissions || !user) return 0;
    const userId = user.id || user._id;
    const submission = quiz.submissions.find((sub: Submission) => {
      const studentId = typeof sub.student === 'object' ? (sub.student.id || sub.student._id) : sub.student;
      return String(studentId) === String(userId);
    });
    return submission?.score || 0;
  };

  // Get teacher name from quiz (handles both object and string cases)
  const getTeacherName = (quiz: Quiz) => {
    if (typeof quiz.teacher === 'object') {
      return quiz.teacher.username;
    }
    return "Teacher";
  };

  // Check if current user is the teacher who created the quiz
  const isQuizOwner = (quiz: Quiz) => {
    if (!user || user.role !== 'teacher') return false;
    const userId = user.id || user._id;
    const teacherId = typeof quiz.teacher === 'object' ? (quiz.teacher.id || quiz.teacher._id) : quiz.teacher;
    return String(teacherId) === String(userId);
  };

  // Get student name from submission
  const getStudentName = (submission: Submission) => {
    if (typeof submission.student === 'object') {
      return submission.student.username;
    }
    return "Student";
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading quizzes...</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Quizzes</h1>
            <p className="text-muted-foreground">
              {user?.role === "student" ? "Take quizzes and test your knowledge" : "Manage quizzes"}
            </p>
          </div>

          {(user?.role === "teacher" || user?.role === "admin") && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Quiz
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Quiz</DialogTitle>
                  <DialogDescription>Add a new quiz for students</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateQuiz} className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Quiz Title *</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Chapter 1 Quiz"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="class">Class *</Label>
                      <Select
                        value={formData.class}
                        onValueChange={(value) => setFormData({ ...formData, class: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a class" />
                        </SelectTrigger>
                        <SelectContent>
                          {classes.map((classItem) => (
                            <SelectItem key={classItem.id || classItem._id} value={classItem.id || classItem._id}>
                              {classItem.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timeLimit">Time Limit (minutes) *</Label>
                      <Input
                        id="timeLimit"
                        type="number"
                        min="1"
                        value={formData.timeLimit}
                        onChange={(e) =>
                          setFormData({ ...formData, timeLimit: parseInt(e.target.value) || 30 })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Quiz description..."
                        rows={2}
                      />
                    </div>
                  </div>

                  {/* Questions */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Questions *</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                        Add Question
                      </Button>
                    </div>
                    {formData.questions.map((question, qIndex) => (
                      <Card key={qIndex} className="p-4">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Question {qIndex + 1} *</Label>
                            <Input
                              value={question.question}
                              onChange={(e) => updateQuestion(qIndex, 'question', e.target.value)}
                              placeholder="Enter question"
                              required
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Points</Label>
                            <Input
                              type="number"
                              min="1"
                              value={question.points || 1}
                              onChange={(e) => updateQuestion(qIndex, 'points', parseInt(e.target.value) || 1)}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Options *</Label>
                            {question.options.map((option, oIndex) => (
                              <div key={oIndex} className="flex gap-2">
                                <Input
                                  value={option}
                                  onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                                  placeholder={`Option ${oIndex + 1}`}
                                  required
                                />
                              </div>
                            ))}
                          </div>
                          <div className="space-y-2">
                            <Label>Correct Answer *</Label>
                            <Select
                              value={question.correctAnswer.toString()}
                              onValueChange={(value) => updateQuestion(qIndex, 'correctAnswer', parseInt(value))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select correct answer" />
                              </SelectTrigger>
                              <SelectContent>
                                {question.options.map((_, index) => (
                                  <SelectItem key={index} value={index.toString()}>
                                    Option {index + 1}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  <Button type="submit" className="w-full" disabled={formLoading}>
                    {formLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Quiz"
                    )}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Quizzes Grid */}
        {quizzes.length === 0 ? (
          <Card className="shadow-md">
            <CardContent className="flex min-h-[300px] items-center justify-center">
              <div className="text-center">
                <Brain className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-lg font-medium">No quizzes available</p>
                <p className="text-sm text-muted-foreground">
                  {user?.role === "student"
                    ? "Check back later for new quizzes from your teachers"
                    : "Create your first quiz to get started"}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((quiz) => (
              <Card key={quiz.id || quiz._id} className="transition-all hover:shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <CardTitle className="text-lg leading-tight">{quiz.title}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        {quiz.class?.name} 
                        {quiz.teacher && ` • By ${getTeacherName(quiz)}`}
                      </CardDescription>
                    </div>
                    
                    {/* Delete button for teachers who own the quiz */}
                    {(user?.role === "teacher" || user?.role === "admin") && isQuizOwner(quiz) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteQuiz(quiz.id || quiz._id)}
                        disabled={deleteLoading === (quiz.id || quiz._id)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      >
                        {deleteLoading === quiz._id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {quiz.description || "No description"}
                  </p>
                  
                  <div className="flex flex-wrap gap-3 border-t pt-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Brain className="h-4 w-4" />
                      {quiz.questions?.length || 0} questions
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {quiz.timeLimit || quiz.time_limit || 0} min
                    </div>
                    <div className="flex items-center gap-1">
                      <Award className="h-4 w-4" />
                      {calculateMaxPoints(quiz)} pts
                    </div>
                    {(user?.role === "teacher" || user?.role === "admin") && (
                      <Badge variant="secondary" className="gap-1">
                        <FileText className="h-3 w-3" />
                        {quiz.submissions?.length || 0} submissions
                      </Badge>
                    )}
                  </div>

                  {/* Student Actions */}
                  {user?.role === "student" && (
                    <div className="flex gap-2">
                      {hasUserSubmitted(quiz) ? (
                        <Button
                          className="flex-1 gap-2"
                          onClick={() => handleReviewQuiz(quiz)}
                          variant="outline"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Review Answers ({getUserScore(quiz)} pts)
                        </Button>
                      ) : (
                        <Button
                          className="w-full gap-2"
                          onClick={() => {
                            setSelectedQuiz(quiz);
                            setAnswers(new Array(quiz.questions?.length || 0).fill(-1));
                            setCurrentQuestion(0);
                            setQuizResult(null);
                            setTakeQuizOpen(true);
                          }}
                        >
                          <Play className="h-4 w-4" />
                          Start Quiz
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Teacher Actions */}
                  {(user?.role === "teacher" || user?.role === "admin") && isQuizOwner(quiz) && (
                    <Button
                      variant="default"
                      className="w-full gap-2"
                      onClick={() => handleViewResults(quiz)}
                    >
                      <FileText className="h-4 w-4" />
                      View Submissions ({quiz.submissions?.length || 0})
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Take Quiz Dialog */}
        <Dialog open={takeQuizOpen} onOpenChange={setTakeQuizOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedQuiz?.title}</DialogTitle>
              <DialogDescription>Answer all questions to complete the quiz</DialogDescription>
            </DialogHeader>
            {quizResult ? (
              <div className="space-y-4 py-6 text-center">
                <CheckCircle2 className="mx-auto h-16 w-16 text-green-600" />
                <div>
                  <h3 className="text-2xl font-bold">Quiz Completed!</h3>
                  <p className="mt-2 text-lg">
                    Score: {quizResult.score} / {quizResult.maxPoints}
                  </p>
                  <p className="text-muted-foreground">
                    {Math.round((quizResult.score / quizResult.maxPoints) * 100)}%
                  </p>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button 
                    onClick={() => setTakeQuizOpen(false)}
                    variant="outline"
                  >
                    Close
                  </Button>
                  <Button 
                    onClick={() => handleReviewQuiz(selectedQuiz!)}
                  >
                    Review Answers
                  </Button>
                </div>
              </div>
            ) : (
              selectedQuiz && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">
                      Question {currentQuestion + 1} of {selectedQuiz.questions.length}
                    </Badge>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {selectedQuiz.timeLimit} min
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-lg font-medium">
                      {selectedQuiz.questions[currentQuestion]?.question}
                    </h4>
                    <RadioGroup
                      value={answers[currentQuestion]?.toString()}
                      onValueChange={(value) => {
                        const newAnswers = [...answers];
                        newAnswers[currentQuestion] = parseInt(value);
                        setAnswers(newAnswers);
                      }}
                    >
                      {selectedQuiz.questions[currentQuestion]?.options.map((option, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                          <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                            {option}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  <div className="flex justify-between gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentQuestion(currentQuestion - 1)}
                      disabled={currentQuestion === 0}
                    >
                      Previous
                    </Button>
                    {currentQuestion === selectedQuiz.questions.length - 1 ? (
                      <Button onClick={handleSubmitQuiz} disabled={formLoading}>
                        {formLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          "Submit Quiz"
                        )}
                      </Button>
                    ) : (
                      <Button onClick={() => setCurrentQuestion(currentQuestion + 1)}>
                        Next
                      </Button>
                    )}
                  </div>
                </div>
              )
            )}
          </DialogContent>
        </Dialog>

        {/* Review Quiz Dialog */}
        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedStudentSubmission 
                  ? `Quiz Review - ${getStudentName(selectedStudentSubmission.submission)}` 
                  : `Quiz Review - ${selectedQuiz?.title}`}
              </DialogTitle>
              <DialogDescription>
                {selectedStudentSubmission 
                  ? `Review ${getStudentName(selectedStudentSubmission.submission)}'s answers` 
                  : "Review your answers and see what you got right and wrong"}
              </DialogDescription>
            </DialogHeader>
            
            {(selectedQuiz && quizResult) || selectedStudentSubmission ? (
              <div className="space-y-6">
                {/* Score Summary */}
                <div className="bg-muted/50 p-4 rounded-lg text-center">
                  <h3 className="text-2xl font-bold text-primary">
                    Score: {selectedStudentSubmission ? selectedStudentSubmission.submission.score : quizResult.score} / {selectedStudentSubmission ? calculateMaxPoints(selectedStudentSubmission.quiz) : quizResult.maxPoints}
                  </h3>
                  <p className="text-muted-foreground">
                    {Math.round(((selectedStudentSubmission ? selectedStudentSubmission.submission.score : quizResult.score) / (selectedStudentSubmission ? calculateMaxPoints(selectedStudentSubmission.quiz) : quizResult.maxPoints)) * 100)}% Correct
                  </p>
                </div>

                {/* Questions Review */}
                <div className="space-y-4">
                  {(selectedStudentSubmission ? selectedStudentSubmission.quiz.questions : selectedQuiz!.questions).map((question, index) => {
                    const result = selectedStudentSubmission 
                      ? selectedStudentSubmission.submission.results?.find((r: QuizResult) => r.questionIndex === index)
                      : quizResult.results?.find((r: QuizResult) => r.questionIndex === index);
                    const isCorrect = result?.correct;
                    
                    return (
                      <Card key={index} className={isCorrect ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              Question {index + 1}
                              {isCorrect ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              ) : (
                                <X className="h-5 w-5 text-red-600" />
                              )}
                            </CardTitle>
                            <Badge variant={isCorrect ? "default" : "destructive"}>
                              {isCorrect ? "Correct" : "Incorrect"} ({question.points || 1} pt)
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <p className="font-medium">{question.question}</p>
                          
                          <div className="space-y-2">
                            <Label>Options:</Label>
                            {question.options.map((option, optIndex) => {
                              const isUserAnswer = result?.userAnswer === optIndex;
                              const isCorrectAnswer = question.correctAnswer === optIndex;
                              
                              return (
                                <div
                                  key={optIndex}
                                  className={`p-2 rounded border ${
                                    isCorrectAnswer
                                      ? "bg-green-100 border-green-300"
                                      : isUserAnswer && !isCorrectAnswer
                                      ? "bg-red-100 border-red-300"
                                      : "bg-white border-gray-200"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    {isCorrectAnswer && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                    {isUserAnswer && !isCorrectAnswer && <X className="h-4 w-4 text-red-600" />}
                                    <span>{option}</span>
                                    {isCorrectAnswer && <Badge variant="outline" className="ml-auto">Correct</Badge>}
                                    {isUserAnswer && <Badge variant="outline">Your Answer</Badge>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* Results Dialog for Teachers */}
        <Dialog open={resultsDialogOpen} onOpenChange={setResultsDialogOpen}>
          <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Quiz Results - {selectedQuiz?.title}</DialogTitle>
              <DialogDescription>
                View all student submissions and performance
              </DialogDescription>
            </DialogHeader>
            {selectedQuiz && (
              <div className="space-y-6">
                {/* Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-primary">{studentSubmissions.length}</div>
                      <div className="text-sm text-muted-foreground">Students Submitted</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {studentSubmissions.length > 0 
                          ? Math.round((studentSubmissions.reduce((sum, sub) => sum + sub.score, 0) / studentSubmissions.length) * 100) / 100
                          : 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Average Score</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {calculateMaxPoints(selectedQuiz)}
                      </div>
                      <div className="text-sm text-muted-foreground">Max Points</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {studentSubmissions.length > 0
                          ? Math.round((studentSubmissions.reduce((sum, sub) => sum + sub.score, 0) / (studentSubmissions.length * calculateMaxPoints(selectedQuiz))) * 100)
                          : 0}%
                      </div>
                      <div className="text-sm text-muted-foreground">Class Average</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Students Table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Percentage</TableHead>
                      <TableHead>Submitted At</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentSubmissions.map((submission) => (
                      <TableRow key={submission._id}>
                        <TableCell className="font-medium">
                          {getStudentName(submission)}
                        </TableCell>
                        <TableCell>
                          {typeof submission.student === 'object' ? (submission.student.email || 'N/A') : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={submission.score >= (calculateMaxPoints(selectedQuiz) * 0.7) ? "default" : "secondary"}>
                            {submission.score} / {calculateMaxPoints(selectedQuiz)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {Math.round((submission.score / calculateMaxPoints(selectedQuiz)) * 100)}%
                        </TableCell>
                        <TableCell>
                          {submission.submittedAt || submission.submitted_at 
                            ? new Date(submission.submittedAt || submission.submitted_at).toLocaleString() 
                            : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const studentId = typeof submission.student === 'object' 
                                ? (submission.student.id || submission.student._id) 
                                : submission.student;
                              handleViewStudentSubmission(selectedQuiz, studentId);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Answers
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {studentSubmissions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No submissions yet</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}