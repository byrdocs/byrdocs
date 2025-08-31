import { LoadingIcon } from "./icons";

export default function Loading() {

  return (
    <div className="loading-container">
      <div>
        <LoadingIcon className="loading-icon" />
        <p className="loading-text">Loading...</p>
      </div>
    </div>
  );
}
