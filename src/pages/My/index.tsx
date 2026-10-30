import MyInfo from "./components/MyInfo";
import TaskList from "./components/TaskList";

const MyPage = () => {
  return (
    <div className="flex-1 w-full overflow-y-auto">
      <div className="max-w-5xl w-full mx-auto p-6 mt-4 pb-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">마이페이지</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <MyInfo />

          <TaskList />
        </div>
      </div>
    </div>
  );
};

export default MyPage;
