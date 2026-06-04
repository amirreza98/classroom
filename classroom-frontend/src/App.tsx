import { Refine } from "@refinedev/core";
import { DevtoolsPanel, DevtoolsProvider } from "@refinedev/devtools";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";

import routerProvider, {
  DocumentTitleHandler,
  UnsavedChangesNotifier,
} from "@refinedev/react-router";
import { BrowserRouter, Outlet, Route, Routes } from "react-router";
import "./App.css";
import { Toaster } from "./components/refine-ui/notification/toaster";
import { useNotificationProvider } from "./components/refine-ui/notification/use-notification-provider";
import { ThemeProvider } from "./components/refine-ui/theme/theme-provider";
import { dataProvider } from "./prodivers/data";
import { Layout } from "./components/refine-ui/layout/layout";

import SubjectsList from "./pages/subjects/list";
import SubjectsCreate from "./pages/subjects/create";
import SubjectsEdit from "./pages/subjects/edit";
import SubjectsShow from "./pages/subjects/show";

import ClassesList from "@/pages/classes/list";
import ClassesCreate from "@/pages/classes/create";
import ClassesShow from "@/pages/classes/show";
import ClassesEdit from "@/pages/classes/edit";
import CollaboratePage from "@/pages/schedule/collaborate";

import UsersList from "@/pages/users/list";
import UsersCreate from "@/pages/users/create";
import UsersEdit from "@/pages/users/edit";
import UsersShow from "@/pages/users/show";

import DepartmentsList from "@/pages/departments/list";
import DepartmentsCreate from "@/pages/departments/create";
import DepartmentsEdit from "@/pages/departments/edit";
import DepartmentsShow from "@/pages/departments/show";

import VoiceList from "./pages/voice/list";
import VoiceConversation from "./pages/voice/conversation";
import SchedulePage from "./pages/schedule";
import ProfilePage from "./pages/profile";
import SubjectChatPage from "./pages/subjects/chat";
import PaymentSuccessPage from "./pages/payment/success";
import PaymentCancelPage from "./pages/payment/cancel";

import { Home, BookOpen, GraduationCap, Users, Building2, Headphones, CalendarDays, UserCircle } from "lucide-react";
import { AuthGuard } from "./components/auth-guard";
import Login from "./pages/login";
import Register from "./pages/register";
import { lazy } from "react";
import { RoleGuard } from "./components/role-guard";
import { useSession } from "./lib/auth-client";

const Dashboard = lazy(() => import("./pages/dashboard"))
const StudentDashboard = lazy(() => import("./pages/student-dashboard"))

function DashboardRouter() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  if (role === 'student') return <StudentDashboard />;
  return <Dashboard />;
}


function App() {
  return (
    <BrowserRouter>
      <RefineKbarProvider>
        <ThemeProvider>
          <DevtoolsProvider>
            <Refine
              dataProvider={dataProvider}
              notificationProvider={useNotificationProvider()}
              routerProvider={routerProvider}
              options={{
                syncWithLocation: true,
                warnWhenUnsavedChanges: true,
                projectId: "tXC0Q4-br3JhF-dHXPfn",
              }}
              resources={[
                {
                  name: 'dashboard',
                  list: '/',
                  meta: { label: 'Home', icon: <Home /> }
                },
                {
                  name: 'departments',
                  list: '/departments',
                  create: '/departments/create',
                  edit: '/departments/edit/:id',
                  show: '/departments/show/:id',
                  meta: { label: 'Departments', icon: <Building2 /> }
                },
                {
                  name: 'subjects',
                  list: '/subjects',
                  create: '/subjects/create',
                  edit: '/subjects/edit/:id',
                  show: '/subjects/show/:id',
                  meta: { label: 'Subjects', icon: <BookOpen /> }
                },
                {
                  name: 'classes',
                  list: '/classes',
                  show: '/classes/show/:id',
                  create: '/classes/create',
                  edit: '/classes/edit/:id',
                  meta: { label: 'Classes', icon: <GraduationCap /> }
                },
                {
                  name: 'users',
                  list: '/users',
                  create: '/users/create',
                  edit: '/users/edit/:id',
                  show: '/users/show/:id',
                  meta: { label: 'Users', icon: <Users /> }
                },
                {
                  name: 'voice',
                  list: '/voice',
                  meta: { label: 'Voice Library', icon: <Headphones /> }
                },
                {
                  name: 'schedule',
                  list: '/schedule',
                  meta: { label: 'My Schedule', icon: <CalendarDays /> }
                },
                {
                  name: 'profile',
                  list: '/profile',
                  meta: { label: 'My Profile', icon: <UserCircle /> }
                },
              ]}
            >
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                <Route element={<AuthGuard><Layout><Outlet /></Layout></AuthGuard>}>

                  {/* Everyone */}
                  <Route path="/" element={<DashboardRouter />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="payment/success" element={<PaymentSuccessPage />} />
                  <Route path="payment/cancel" element={<PaymentCancelPage />} />
                  <Route path="subjects/:subjectId/chat" element={<SubjectChatPage />} />
                  <Route path="schedule">
                    <Route index element={<SchedulePage />} />
                    <Route path="class/:classId" element={<CollaboratePage />} />
                  </Route>
                  <Route path="voice">
                    <Route index element={<VoiceList />} />
                    <Route path=":bookId" element={<VoiceConversation />} />
                  </Route>
                  <Route path="/classes">
                    <Route index element={<ClassesList />} />
                    <Route path="show/:id" element={<ClassesShow />} />
                  </Route>

                  {/* Teacher + Admin */}
                  <Route element={<RoleGuard allowedRoles={['teacher', 'admin']} />}>
                    <Route path="dashboard" element={<Dashboard />} />

                    <Route path="classes">
                      <Route index element={<ClassesList />} />
                      <Route path="create" element={<ClassesCreate />} />
                      <Route path="edit/:id" element={<ClassesEdit />} />
                      <Route path="show/:id" element={<ClassesShow />} />
                    </Route>
                    <Route path="subjects">
                      <Route index element={<SubjectsList />} />
                      <Route path="create" element={<SubjectsCreate />} />
                      <Route path="edit/:id" element={<SubjectsEdit />} />
                      <Route path="show/:id" element={<SubjectsShow />} />
                    </Route>
                    <Route path="departments">
                      <Route index element={<DepartmentsList />} />
                      <Route path="create" element={<DepartmentsCreate />} />
                      <Route path="edit/:id" element={<DepartmentsEdit />} />
                      <Route path="show/:id" element={<DepartmentsShow />} />
                    </Route>
                  </Route>

                  {/* Admin only */}
                  <Route element={<RoleGuard allowedRoles={['admin']} />}>
                    <Route path="users">
                      <Route index element={<UsersList />} />
                      <Route path="create" element={<UsersCreate />} />
                      <Route path="edit/:id" element={<UsersEdit />} />
                      <Route path="show/:id" element={<UsersShow />} />
                    </Route>
                  </Route>

                </Route>
              </Routes>
              <Toaster />
              <RefineKbar />
              <UnsavedChangesNotifier />
              <DocumentTitleHandler />
            </Refine>
            <DevtoolsPanel />
          </DevtoolsProvider>
        </ThemeProvider>
      </RefineKbarProvider>
    </BrowserRouter>
  );
}

export default App;
