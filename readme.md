🛠️ Tech Stack
Frontend

    React with TypeScript
    Tailwind CSS for styling
    shadcn/ui components
    React Router for navigation
    TanStack Query for data fetching
    React Hook Form for form handling
    Lucide React for icons

Backend

    Node.js with Express.js
    SUPABASE:DB with SUPABASE ODM
    JWT for authentication
    bcrypt for password hashing
    CORS for cross-origin requests

📁 Project Structure

OOAD-PROJECT/ ├── backend/ # Backend server code │ ├── controllers/ # Route controllers │ ├── models/ # MongoDB models │ ├── routes/ # API routes │ ├── middleware/ # Custom middleware │ ├── config/ # Database and app configuration │ ├── utils/ # Utility functions │ └── server.js # Entry point └── student-hub/ # Frontend React application ├── src/ │ ├── components/ # Reusable UI components │ ├── pages/ # Page components │ ├── context/ # React context providers │ ├── hooks/ # Custom React hooks │ ├── services/ # API service functions │ └── utils/ # Utility functions └── package.json
👥 User Roles & Features
👨‍🎓 Student

    View and enroll in classes
    Access assignments and quizzes
    Submit assignments
    Take quizzes
    Track academic progress
    View grades and feedback

👨‍🏫 Teacher

    Create and manage classes
    Create assignments and quizzes
    Grade student submissions
    Track class performance
    Manage student enrollments

👨‍💼 Admin

    User management (students, teachers)
    Class management
    Assignment and Quiz management
    System-wide analytics
    Platform configuration

🚀 Getting Started
Prerequisites

    Node.js (v16 or higher)
    MongoDB (v4.4 or higher)
    npm or yarn

Installation
Navigate to the project directory

cd OOAD-PROJECT

Backend Setup

    cd backend
    npm install Server will run on http://localhost:5000

Environment Configuration

    Create a .env file in the backend directory:
    PORT=5000
    SOPABASE_URI=supabase://localhost:27017/student-hub
    JWT_SECRET=your-jwt-secret-key
    NODE_ENV=development

    # Supabase (required)
    SUPABASE_URL=https://<your-project>.supabase.co
    SUPABASE_ANON_KEY=eyJ...          # public anon key (used by client-side code)
    SUPABASE_SERVICE_ROLE_KEY=eyJ...   # server-only secret: **DO NOT COMMIT**. Used by the backend to bypass RLS for server operations (e.g., creating profiles)

  Notes:
  - Place the `SUPABASE_SERVICE_ROLE_KEY` in the **backend** `.env` only. Keep it secret (do not check into source control).
  - The frontend (student-hub) expects `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `student-hub/.env` (these are the same values as the URL and anon key above but prefixed with `VITE_`).
  - After adding env vars, restart both dev servers:
      cd backend && npm run dev
      cd ../student-hub && npm run dev

Frontend Setup

    cd ../student-hub
    npm install Server will run on http://localhost:8080

📚 API Endpoints

Authentication

    POST /api/auth/register - User registration
    POST /api/auth/login - User login

Admin-only

    POST /api/admin/create-user - Create a new user (student, teacher or admin). This endpoint is protected and requires an Authorization header with an admin user's Supabase JWT (`Authorization: Bearer <token>`).

Example curl (create admin):

    curl -X POST http://localhost:5000/api/admin/create-user \
      -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
      -H "Content-Type: application/json" \
      -d '{"username":"newadmin","email":"admin@example.com","password":"SecurePass123","role":"admin"}'

Note: Creating actual Supabase admin users requires `SUPABASE_SERVICE_ROLE_KEY` set in the backend environment. If that key is missing the endpoint will return an error when you attempt to create `role: "admin"`. Creating `student` or `teacher` will fall back to the regular sign-up flow if a service role key is not present.

Development helper — Bootstrap initial admin 🔧

If you don't yet have an admin account you can use the development-only endpoint to bootstrap one:

1. Add `ADMIN_BOOTSTRAP_TOKEN` to `backend/.env` (pick a long random secret).
2. Start the backend dev server.
3. Run:

    curl -X POST http://localhost:5000/api/admin/bootstrap-admin \
      -H "x-admin-bootstrap-token: <ADMIN_BOOTSTRAP_TOKEN>" \
      -H "Content-Type: application/json" \
      -d '{"username":"superadmin","email":"admin@example.com","password":"StrongP@ssw0rd"}'

This endpoint is disabled in production (`NODE_ENV=production`) and requires the explicit `ADMIN_BOOTSTRAP_TOKEN` to run.

Classes

    GET /api/classes - Get all classes
    POST /api/classes - Create new class
    GET /api/classes/:id - Get class details
    DELETE /api/classes/:id - Delete class
    PUT /api/classes/:id - Update class

Assignments

    GET /api/assignments - Get assignments
    POST /api/assignments - Create assignment
    GET /api/assignments/:id - Get assignment details
    DELETE /api/assignments/:id - Delete assignment
    PUT /api/assignments/:id - Update assignment

Quizzes

    GET /api/quizzes - Get quizzes
    POST /api/quizzes - Create quiz
    GET /api/quizzes/:id - Get quiz details
    POST /api/quizzes/:id/submit - Submit quiz

🗃️ Database Models

    User - Students, Teachers, Admins
    Class - Course information
    Assignment - Homework and projects
    Quiz - Assessments and tests
    Submission - Student work submissions
    Grade - Evaluation results

🔐 Authentication & Authorization

    JWT-based authentication
    Role-based access control (RBAC)
    Protected routes for different user types
    Session management with secure tokens

🎨 UI/UX Features

    Responsive design for all devices
    Modern and clean interface
    Role-based dashboard redirection
    Accessible components

🚧 Development

You can run both frontend and backend from the root directory:
Terminal 1 - Backend

cd backend npm run dev
Terminal 2 - Frontend

cd student-hub npm run dev
🤝 Contributing

    Fork the repository
    Create a feature branch
    Commit your changes
    Push to the branch
    Open a Pull Request

📄 License

This project is licensed under the MIT License.
👥 Authors

    Min Phanith and team- OOAD Project.

🙏 Acknowledgments

    Object-Oriented Analysis and Design Course Requirements
    Open source community for amazing tools and libraries
    Instructor for guidelines ()
