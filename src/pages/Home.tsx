
import { Search } from "@/components/search";
import { Link } from "react-router-dom";

// @ts-ignore
import '@fontsource-variable/saira';
import { useState } from "react";
import { Banner } from "@/config";

function App() {
  const [preview, setPreview] = useState<false | string>(false);
  return (
    <div className="flex flex-col h-dvh">
      <Banner style={preview ? { width: `calc(100vw - ${preview})` } : undefined}/>
      <div className="flex-1 flex flex-col justify-center items-center">
        <Search onPreview={setPreview}/>
      </div>
      <footer style={preview ? { width: `calc(100vw - ${preview})` } : undefined}>
        <div className="w-full m-auto h-12 mt-12">
          <div className="text-center">
          <Link to="https://github.com/byrdocs/" className="hover:underline">GitHub</Link>
          <span className="mx-2 border-l border-current"></span>
          <Link to="/about" className="hover:underline">关于我们</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
